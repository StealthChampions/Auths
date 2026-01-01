/**
 * Encryption Module | 加密模块
 *
 * Provides AES encryption/decryption with PBKDF2 key derivation.
 * Used for securing backup files and WebDAV credentials.
 *
 * 提供基于 PBKDF2 密钥派生的 AES 加密/解密功能。
 * 用于保护备份文件和 WebDAV 凭据。
 */

import * as CryptoJS from "crypto-js";

// Encryption configuration constants | 加密配置常量
const PBKDF2_ITERATIONS = 100000;
const KEY_SIZE = 256 / 32; // 256 bits
const IV_SIZE = 128 / 32;  // 128 bits

export class Encryption implements EncryptionInterface {
  private password: string;
  private keyId: string;
  private salt: string;

  constructor(hash: string, keyId: string, salt?: string) {
    this.password = hash;
    this.keyId = keyId;
    // Generate new salt if not provided | 如果没有提供 salt，生成一个新的
    this.salt = salt || CryptoJS.lib.WordArray.random(128 / 8).toString();
  }

  /**
   * Derive encryption key using PBKDF2 | 使用 PBKDF2 派生加密密钥
   */
  private deriveKey(password: string, salt: string): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: KEY_SIZE,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
  }

  /**
   * 加密字符串 - 使用 AES-256-CBC with PBKDF2
   */
  getEncryptedString(data: string): string {
    if (!this.password) {
      return data;
    }

    try {
      // 生成随机 IV
      const iv = CryptoJS.lib.WordArray.random(IV_SIZE * 4);
      // 使用 PBKDF2 派生密钥
      const key = this.deriveKey(this.password, this.salt);

      // AES 加密
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      // 返回格式: salt:iv:ciphertext (都是 Base64)
      return `${this.salt}:${iv.toString(CryptoJS.enc.Base64)}:${encrypted.ciphertext.toString(CryptoJS.enc.Base64)}`;
    } catch (error) {
      console.error("Encryption failed:", error);
      return data;
    }
  }

  /**
   * 解密字符串
   */
  private decryptString(encryptedData: string): string | null {
    if (!this.password || !encryptedData) {
      return null;
    }

    try {
      // 检查是否为新格式 (salt:iv:ciphertext)
      if (encryptedData.includes(':')) {
        const parts = encryptedData.split(':');
        if (parts.length === 3) {
          const [salt, ivBase64, ciphertextBase64] = parts;

          const iv = CryptoJS.enc.Base64.parse(ivBase64);
          const ciphertext = CryptoJS.enc.Base64.parse(ciphertextBase64);
          const key = this.deriveKey(this.password, salt);

          const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext } as CryptoJS.lib.CipherParams,
            key,
            {
              iv: iv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7
            }
          );

          return decrypted.toString(CryptoJS.enc.Utf8);
        }
      }

      // 兼容旧格式 (直接 CryptoJS 加密)
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.password);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Decryption failed:", error);
      return null;
    }
  }

  decryptSecretString(secret: string): string | null {
    try {
      const decryptedSecret = this.decryptString(secret);

      if (!decryptedSecret) {
        return null;
      }

      if (decryptedSecret.length < 8) {
        return null;
      }

      if (
        !/^[a-z2-7]+=*$/i.test(decryptedSecret) &&
        !/^[0-9a-f]+$/i.test(decryptedSecret) &&
        !/^blz-/.test(decryptedSecret) &&
        !/^bliz-/.test(decryptedSecret) &&
        !/^stm-/.test(decryptedSecret)
      ) {
        return null;
      }

      return decryptedSecret;
    } catch (error) {
      return null;
    }
  }

  decryptEncSecret(entry: OTPEntryInterface): RawOTPStorage | null {
    try {
      if (!entry.encData) {
        return null;
      }

      const decryptedData = this.decryptString(entry.encData);

      if (!decryptedData) {
        return null;
      }

      return JSON.parse(decryptedData);
    } catch (error) {
      return null;
    }
  }

  getEncryptionStatus(): boolean {
    return this.password ? true : false;
  }

  updateEncryptionPassword(password: string) {
    this.password = password;
  }

  setEncryptionKeyId(id: string): void {
    this.keyId = id;
  }

  getEncryptionKeyId(): string {
    return this.keyId;
  }

  getSalt(): string {
    return this.salt;
  }
}

/**
 * 安全的密码哈希工具类
 */
export class SecureHash {
  private static readonly HASH_ITERATIONS = 100000;

  /**
   * 生成密码哈希 (用于存储验证)
   * 返回格式: salt:hash
   */
  static hashPassword(password: string): string {
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: this.HASH_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    }).toString();

    return `${salt}:${hash}`;
  }

  /**
   * 验证密码
   */
  static verifyPassword(password: string, storedHash: string): boolean {
    try {
      const [salt, hash] = storedHash.split(':');
      if (!salt || !hash) {
        return false;
      }

      const computedHash = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: this.HASH_ITERATIONS,
        hasher: CryptoJS.algo.SHA256
      }).toString();

      return computedHash === hash;
    } catch {
      return false;
    }
  }

  /**
   * 加密敏感数据 (如 WebDAV 凭据)
   */
  static encryptData(data: string, masterPassword: string): string {
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const key = CryptoJS.PBKDF2(masterPassword, salt, {
      keySize: 256 / 32,
      iterations: this.HASH_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });

    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return `${salt}:${iv.toString(CryptoJS.enc.Base64)}:${encrypted.ciphertext.toString(CryptoJS.enc.Base64)}`;
  }

  /**
   * 解密敏感数据
   */
  static decryptData(encryptedData: string, masterPassword: string): string | null {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        return null;
      }

      const [salt, ivBase64, ciphertextBase64] = parts;
      const iv = CryptoJS.enc.Base64.parse(ivBase64);
      const ciphertext = CryptoJS.enc.Base64.parse(ciphertextBase64);
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: this.HASH_ITERATIONS,
        hasher: CryptoJS.algo.SHA256
      });

      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext } as CryptoJS.lib.CipherParams,
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }
}
