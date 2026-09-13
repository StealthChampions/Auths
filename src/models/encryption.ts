/**
 * Encryption Module | 加密模块
 *
 * Provides AES encryption/decryption with PBKDF2 key derivation.
 * Used for securing password-protected backup exports.
 *
 * 提供基于 PBKDF2 密钥派生的 AES 加密/解密功能。
 * 用于保护带密码的备份导出。
 */

import * as CryptoJS from "crypto-js";

/**
 * Secure backup file encryption.
 * 安全备份文件加密。
 */
export class SecureHash {
  private static readonly HASH_ITERATIONS = 100000;
  private static readonly BACKUP_ENCRYPTION_VERSION = 2;

  /**
   * Generate a password hash for storage verification.
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
   * Verify a password against a stored hash.
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
   * Encrypt password-protected backup exports.
   * 加密带密码的备份导出。
   */
  private static encryptDataLegacy(data: string, masterPassword: string): string {
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

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(value: string): ArrayBuffer {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static async deriveAesGcmKey(password: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptData(data: string, masterPassword: string): Promise<string> {
    if (!crypto.subtle) {
      return this.encryptDataLegacy(data, masterPassword);
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveAesGcmKey(masterPassword, salt.buffer, this.HASH_ITERATIONS);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(data)
    );

    return JSON.stringify({
      version: this.BACKUP_ENCRYPTION_VERSION,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: this.HASH_ITERATIONS,
      salt: this.arrayBufferToBase64(salt.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
      ciphertext: this.arrayBufferToBase64(ciphertext),
    });
  }

  private static decryptDataLegacy(encryptedData: string, masterPassword: string): string | null {
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

  /**
   * Decrypt sensitive data.
   * 解密敏感数据
   */
  static async decryptData(encryptedData: string, masterPassword: string): Promise<string | null> {
    try {
      const payload = JSON.parse(encryptedData);
      if (
        payload?.version !== this.BACKUP_ENCRYPTION_VERSION ||
        payload?.algorithm !== 'AES-GCM' ||
        typeof payload.salt !== 'string' ||
        typeof payload.iv !== 'string' ||
        typeof payload.ciphertext !== 'string'
      ) {
        return this.decryptDataLegacy(encryptedData, masterPassword);
      }

      const iterations = Number(payload.iterations) || this.HASH_ITERATIONS;
      const salt = this.base64ToArrayBuffer(payload.salt);
      const iv = this.base64ToArrayBuffer(payload.iv);
      const ciphertext = this.base64ToArrayBuffer(payload.ciphertext);
      const key = await this.deriveAesGcmKey(masterPassword, salt, iterations);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch {
      return this.decryptDataLegacy(encryptedData, masterPassword);
    }
  }
}