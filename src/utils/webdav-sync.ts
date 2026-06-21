import { formatLocalDate } from '@/utils/date';

export interface WebDAVBackupFile {
  name: string;
  timestamp: number;
  deviceId?: string;
  deviceName?: string;
  legacy: boolean;
}

export interface WebDAVBackupData<T = unknown> {
  version: string;
  timestamp: number;
  deviceId?: string;
  deviceName?: string;
  accounts: T[];
}

export interface WebDAVCleanupResult {
  deleted: string[];
  failed: Array<{ name: string; status: number }>;
  skipped: boolean;
}

export function getWebDAVAuthHeader(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`);
}

export function getWebDAVFileUrl(serverUrl: string, filename: string): string {
  const encodedFilename = encodeURIComponent(filename);
  return serverUrl.endsWith('/') ? `${serverUrl}${encodedFilename}` : `${serverUrl}/${encodedFilename}`;
}

const WEBDAV_DEVICE_ID_KEY = 'webdavDeviceId';
const WEBDAV_DEVICE_NAME_KEY = 'webdavDeviceName';
const BACKUP_FILENAME_PREFIX = 'auths-backup';
const DEVICE_ID_LENGTH = 12;
const LEGACY_BACKUP_FILENAME_REGEX = /^auths-backup-\d{4}-\d{2}-\d{2}\.json$/;
const DEVICE_BACKUP_FILENAME_REGEX = /^auths-backup-([a-z0-9]{12})-\d{4}-\d{2}-\d{2}\.json$/;
const NAMED_DEVICE_BACKUP_FILENAME_REGEX = /^auths-backup-([a-z0-9]{12})-(.+)-\d{4}-\d{2}-\d{2}\.json$/;

function generateWebDAVDeviceId(): string {
  const randomBytes = new Uint8Array(DEVICE_ID_LENGTH);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => (byte % 36).toString(36)).join('');
}

export async function getWebDAVDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get([WEBDAV_DEVICE_ID_KEY]);
  const existingDeviceId = result[WEBDAV_DEVICE_ID_KEY];

  if (typeof existingDeviceId === 'string' && /^[a-z0-9]{12}$/.test(existingDeviceId)) {
    return existingDeviceId;
  }

  const deviceId = generateWebDAVDeviceId();
  await chrome.storage.local.set({ [WEBDAV_DEVICE_ID_KEY]: deviceId });
  return deviceId;
}

function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/OPR\//.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent) || /Chromium\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return 'Browser';
}

function getOSName(): string {
  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Device';
}

function getDefaultDeviceName(): string {
  return `${getBrowserName()} on ${getOSName()}`;
}

export function normalizeWebDAVDeviceName(deviceName: string): string {
  const normalized = deviceName.trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 60);
}

export function getDeviceNameSlug(deviceName: string): string {
  const slug = normalizeWebDAVDeviceName(deviceName)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'device';
}

export async function getWebDAVDeviceName(): Promise<string> {
  const result = await chrome.storage.local.get([WEBDAV_DEVICE_NAME_KEY]);
  const existingDeviceName = result[WEBDAV_DEVICE_NAME_KEY];

  if (typeof existingDeviceName === 'string' && normalizeWebDAVDeviceName(existingDeviceName)) {
    return normalizeWebDAVDeviceName(existingDeviceName);
  }

  const deviceName = getDefaultDeviceName();
  await chrome.storage.local.set({ [WEBDAV_DEVICE_NAME_KEY]: deviceName });
  return deviceName;
}

export async function setWebDAVDeviceName(deviceName: string): Promise<string> {
  const normalizedDeviceName = normalizeWebDAVDeviceName(deviceName) || getDefaultDeviceName();
  await chrome.storage.local.set({ [WEBDAV_DEVICE_NAME_KEY]: normalizedDeviceName });
  return normalizedDeviceName;
}

export function getBackupFilename(deviceId: string, date = new Date(), deviceName?: string): string {
  if (deviceName) {
    return `${BACKUP_FILENAME_PREFIX}-${deviceId}-${getDeviceNameSlug(deviceName)}-${formatLocalDate(date)}.json`;
  }

  return `${BACKUP_FILENAME_PREFIX}-${deviceId}-${formatLocalDate(date)}.json`;
}

export function parseWebDAVBackupFilename(filename: string): Pick<WebDAVBackupFile, 'deviceId' | 'deviceName' | 'legacy'> | null {
  if (LEGACY_BACKUP_FILENAME_REGEX.test(filename)) {
    return { legacy: true };
  }

  const deviceMatch = DEVICE_BACKUP_FILENAME_REGEX.exec(filename);
  if (deviceMatch) {
    return { deviceId: deviceMatch[1], legacy: false };
  }

  const namedDeviceMatch = NAMED_DEVICE_BACKUP_FILENAME_REGEX.exec(filename);
  if (namedDeviceMatch) {
    return {
      deviceId: namedDeviceMatch[1],
      deviceName: namedDeviceMatch[2],
      legacy: false,
    };
  }

  return null;
}

export function parseWebDAVBackupFiles(xmlText: string): WebDAVBackupFile[] {
  const files: WebDAVBackupFile[] = [];
  const responseRegex = /<(?:\w+:)?response[^>]*>([\s\S]*?)<\/(?:\w+:)?response>/gi;
  const hrefRegex = /<(?:\w+:)?href[^>]*>([^<]*)<\/(?:\w+:)?href>/i;
  const lastModRegex = /<(?:\w+:)?getlastmodified[^>]*>([^<]*)<\/(?:\w+:)?getlastmodified>/i;

  let match;
  while ((match = responseRegex.exec(xmlText)) !== null) {
    const responseBlock = match[1];
    const href = hrefRegex.exec(responseBlock)?.[1] || '';
    const lastModified = lastModRegex.exec(responseBlock)?.[1] || '';

    const name = decodeURIComponent(href.split('/').pop() || '');
    const metadata = parseWebDAVBackupFilename(name);

    if (metadata) {
      files.push({
        name,
        timestamp: lastModified ? new Date(lastModified).getTime() : 0,
        ...metadata,
      });
    }
  }

  return files;
}

export async function listWebDAVBackups(
  serverUrl: string,
  username: string,
  password: string
): Promise<WebDAVBackupFile[]> {
  const response = await fetch(serverUrl, {
    method: 'PROPFIND',
    headers: {
      'Authorization': getWebDAVAuthHeader(username, password),
      'Depth': '1',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8" ?>
      <D:propfind xmlns:D="DAV:">
        <D:prop><D:displayname/><D:getlastmodified/></D:prop>
      </D:propfind>`,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return parseWebDAVBackupFiles(await response.text());
}

export async function getLatestWebDAVBackup(
  serverUrl: string,
  username: string,
  password: string
): Promise<WebDAVBackupFile | null> {
  const files = await listWebDAVBackups(serverUrl, username, password);
  return files.reduce<WebDAVBackupFile | null>((latest, file) => {
    if (!latest || file.timestamp > latest.timestamp) return file;
    return latest;
  }, null);
}

export async function downloadWebDAVBackup<T>(
  serverUrl: string,
  username: string,
  password: string,
  filename: string
): Promise<WebDAVBackupData<T>> {
  const response = await fetch(getWebDAVFileUrl(serverUrl, filename), {
    method: 'GET',
    headers: {
      'Authorization': getWebDAVAuthHeader(username, password),
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const backupData = await response.json();
  if (!backupData.accounts || !Array.isArray(backupData.accounts)) {
    throw new Error('Invalid backup format');
  }

  return backupData;
}

export async function uploadWebDAVBackup<T>(
  serverUrl: string,
  username: string,
  password: string,
  accounts: T[],
  filename?: string
): Promise<string> {
  const deviceId = await getWebDAVDeviceId();
  const deviceName = await getWebDAVDeviceName();
  const targetFilename = filename || getBackupFilename(deviceId, new Date(), deviceName);
  const backupData: WebDAVBackupData<T> = {
    version: '1.0',
    timestamp: Date.now(),
    deviceId,
    deviceName,
    accounts,
  };

  const response = await fetch(getWebDAVFileUrl(serverUrl, targetFilename), {
    method: 'PUT',
    headers: {
      'Authorization': getWebDAVAuthHeader(username, password),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backupData, null, 2),
  });

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`Upload failed: HTTP ${response.status}`);
  }

  return targetFilename;
}

export async function deleteWebDAVBackup(
  serverUrl: string,
  username: string,
  password: string,
  filename: string
): Promise<void> {
  const response = await fetch(getWebDAVFileUrl(serverUrl, filename), {
    method: 'DELETE',
    headers: {
      'Authorization': getWebDAVAuthHeader(username, password),
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete failed: HTTP ${response.status}`);
  }
}

export async function cleanupExpiredWebDAVBackups(
  serverUrl: string,
  username: string,
  password: string,
  retentionDays = 30
): Promise<WebDAVCleanupResult> {
  if (retentionDays < 0) {
    return { deleted: [], failed: [], skipped: true };
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const currentDeviceId = await getWebDAVDeviceId();
  const files = await listWebDAVBackups(serverUrl, username, password);
  const expiredFiles = files.filter((file) =>
    !file.legacy &&
    file.deviceId === currentDeviceId &&
    file.timestamp > 0 &&
    file.timestamp < cutoff
  );
  const result: WebDAVCleanupResult = { deleted: [], failed: [], skipped: false };

  for (const file of expiredFiles) {
    try {
      await deleteWebDAVBackup(serverUrl, username, password, file.name);
      result.deleted.push(file.name);
    } catch (error) {
      const statusMatch = error instanceof Error ? error.message.match(/HTTP (\d+)/) : null;
      result.failed.push({
        name: file.name,
        status: statusMatch ? Number(statusMatch[1]) : 0,
      });
    }
  }

  return result;
}
