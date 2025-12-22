import { Encryption, SecureHash } from "./encryption";
import { EntryStorage } from "./storage";

/**
 * 从 session storage 获取缓存的主密码
 */
async function getCachedPassphrase(): Promise<string | null> {
  try {
    const result = await chrome.storage.session.get(['cachedPassphrase']);
    return result.cachedPassphrase || null;
  } catch {
    return null;
  }
}

/**
 * 解密 WebDAV 密码
 */
async function decryptWebDAVPassword(config: {
  encryptedPassword?: string;
  password?: string;
}): Promise<string | null> {
  // 优先使用加密密码
  if (config.encryptedPassword) {
    const masterPassword = await getCachedPassphrase();
    if (masterPassword) {
      return SecureHash.decryptData(config.encryptedPassword, masterPassword);
    }
    return null;
  }
  // 兼容旧版本明文密码
  return config.password || null;
}

/**
 * WebDAV 备份提供者
 * Phase 1 MVP: 仅支持 WebDAV 自托管备份
 */
export class WebDAV implements BackupProvider {
  async upload(encryption: Encryption) {
    const config = (await chrome.storage.local.get(['webdavConfig'])).webdavConfig;

    if (!config || !config.serverUrl || !config.username) {
      return false;
    }

    // 解密密码
    const password = await decryptWebDAVPassword(config);
    if (!password) {
      // 无法解密密码（可能未解锁），跳过自动备份
      return false;
    }

    const { serverUrl, username } = config;

    // Encrypt by default
    const encrypted = true;

    // Get export data
    const exportData = await EntryStorage.backupGetExport(encryption, encrypted);

    const backupData = {
      version: '1.0',
      timestamp: Date.now(),
      accounts: exportData
    };

    const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `auths-backup-${now}.json`;
    const uploadUrl = serverUrl.endsWith('/')
      ? `${serverUrl}${filename}`
      : `${serverUrl}/${filename}`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backupData, null, 2)
      });

      if (response.ok || response.status === 201 || response.status === 204) {
        if (config.retentionDays && config.retentionDays > 0) {
          await this.cleanupOldBackups(serverUrl, username, password, config.retentionDays);
        }
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  private async cleanupOldBackups(serverUrl: string, username: string, password: string, retentionDays: number) {
    try {
      // List files using PROPFIND
      const response = await fetch(serverUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Depth': '1'
        }
      });

      if (!response.ok) return;

      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");

      // Parse WebDAV XML to find href elements
      const nodes = doc.getElementsByTagNameNS("*", "href");
      const filesToDelete: string[] = [];
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      for (let i = 0; i < nodes.length; i++) {
        const href = nodes[i].textContent || "";
        // Match backup files: auths-backup-YYYYMMDD.json
        const match = href.match(/auths-backup-(\d{8})\.json$/);
        if (match) {
          const dateStr = match[1];
          const year = Number.parseInt(dateStr.substring(0, 4));
          const month = Number.parseInt(dateStr.substring(4, 6)) - 1;
          const day = Number.parseInt(dateStr.substring(6, 8));

          const fileDate = new Date(year, month, day).getTime();
          const ageDays = (now - fileDate) / msPerDay;

          if (ageDays > retentionDays) {
            filesToDelete.push(href);
          }
        }
      }

      // Delete old backup files
      for (const fileHref of filesToDelete) {
        let deleteUrl = fileHref;
        if (!fileHref.startsWith("http")) {
          const urlObj = new URL(serverUrl);
          deleteUrl = `${urlObj.origin}${fileHref}`;
        }

        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Basic ' + btoa(`${username}:${password}`)
          }
        });
      }

    } catch {
      // Cleanup failure is not critical, silently ignore
    }
  }

  async getUser() {
    const config = (await chrome.storage.local.get(['webdavConfig'])).webdavConfig;
    return config && config.username ? config.username : "Not configured";
  }
}
