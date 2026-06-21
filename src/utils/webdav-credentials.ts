const DB_NAME = 'auths-secure-storage';
const DB_VERSION = 1;
const STORE_NAME = 'cryptoKeys';
const WEBDAV_KEY_ID = 'webdav-credential-key';

export interface WebDAVConfigLike {
  serverUrl?: string;
  username?: string;
  password?: string;
  passwordEncrypted?: string;
  passwordIv?: string;
  passwordVersion?: number;
  [key: string]: unknown;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open secure storage'));
  });
}

async function getStoredKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(WEBDAV_KEY_ID);
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Failed to read secure key'));
  });
}

async function storeKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(key, WEBDAV_KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to store secure key'));
  });
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openDb();
  try {
    const storedKey = await getStoredKey(db);
    if (storedKey) return storedKey;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    await storeKey(db, key);
    return key;
  } finally {
    db.close();
  }
}

export async function encryptWebDAVPassword(password: string): Promise<Pick<WebDAVConfigLike, 'passwordEncrypted' | 'passwordIv' | 'passwordVersion'>> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(password)
  );

  return {
    passwordEncrypted: arrayBufferToBase64(encrypted),
    passwordIv: arrayBufferToBase64(iv.buffer),
    passwordVersion: 1,
  };
}

export async function decryptWebDAVPassword(config?: WebDAVConfigLike | null): Promise<string> {
  if (!config) return '';
  if (config.passwordEncrypted && config.passwordIv) {
    const key = await getOrCreateKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(config.passwordIv) },
      key,
      base64ToArrayBuffer(config.passwordEncrypted)
    );
    return new TextDecoder().decode(decrypted);
  }

  return config.password || '';
}

export async function withEncryptedWebDAVPassword(
  config: WebDAVConfigLike,
  password: string
): Promise<WebDAVConfigLike> {
  const encryptedPassword = await encryptWebDAVPassword(password);
  const { password: _password, ...safeConfig } = config;
  return {
    ...safeConfig,
    ...encryptedPassword,
  };
}

export async function migratePlainWebDAVConfig(config?: WebDAVConfigLike | null): Promise<WebDAVConfigLike | null> {
  if (!config) {
    return null;
  }

  if (config.passwordEncrypted && config.passwordIv) {
    if (config.password) {
      const { password: _password, ...safeConfig } = config;
      await chrome.storage.local.set({ webdavConfig: safeConfig });
      return safeConfig;
    }
    return config;
  }

  if (!config.password) {
    return config || null;
  }

  const migratedConfig = await withEncryptedWebDAVPassword(config, config.password);
  await chrome.storage.local.set({ webdavConfig: migratedConfig });
  return migratedConfig;
}
