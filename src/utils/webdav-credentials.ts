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
  updatedAt?: number;
  [key: string]: unknown;
}

const WEBDAV_CONFIG_STORAGE_KEY = 'webdavConfig';

interface SyncedWebDAVConfig extends WebDAVConfigLike {
  serverUrl?: string;
  username?: string;
  autoBackup?: boolean;
  backupInterval?: number;
  retentionDays?: number;
  syncOnStartup?: boolean;
  updatedAt: number;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function buildSyncedWebDAVConfig(
  config?: WebDAVConfigLike | null,
  fallbackUpdatedAt = Date.now()
): SyncedWebDAVConfig | null {
  if (!config) return null;

  const syncedConfig: SyncedWebDAVConfig = {
    updatedAt: toNumber(config.updatedAt) || fallbackUpdatedAt,
  };
  const backupInterval = toNumber(config.backupInterval);
  const retentionDays = toNumber(config.retentionDays);
  const autoBackup = toBoolean(config.autoBackup);
  const syncOnStartup = toBoolean(config.syncOnStartup);

  if (typeof config.serverUrl === 'string') syncedConfig.serverUrl = config.serverUrl;
  if (typeof config.username === 'string') syncedConfig.username = config.username;
  if (autoBackup !== undefined) syncedConfig.autoBackup = autoBackup;
  if (backupInterval !== undefined) syncedConfig.backupInterval = backupInterval;
  if (retentionDays !== undefined) syncedConfig.retentionDays = retentionDays;
  if (syncOnStartup !== undefined) syncedConfig.syncOnStartup = syncOnStartup;

  return Object.keys(syncedConfig).length > 1 ? syncedConfig : null;
}

function omitPasswordFields(config: WebDAVConfigLike): WebDAVConfigLike {
  const {
    password: _password,
    passwordEncrypted: _passwordEncrypted,
    passwordIv: _passwordIv,
    passwordVersion: _passwordVersion,
    ...safeConfig
  } = config;
  return safeConfig;
}

function hasCredentialTargetChanged(localConfig: WebDAVConfigLike, syncedConfig: SyncedWebDAVConfig): boolean {
  return (
    Boolean(localConfig.serverUrl && syncedConfig.serverUrl && localConfig.serverUrl !== syncedConfig.serverUrl) ||
    Boolean(localConfig.username && syncedConfig.username && localConfig.username !== syncedConfig.username)
  );
}

async function setSyncedWebDAVConfig(config: SyncedWebDAVConfig): Promise<void> {
  try {
    await chrome.storage.sync.set({ [WEBDAV_CONFIG_STORAGE_KEY]: config });
  } catch {
    // Sync storage may be unavailable in some browser modes; local encrypted config still works.
  }
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
      await chrome.storage.local.set({ [WEBDAV_CONFIG_STORAGE_KEY]: safeConfig });
      return safeConfig;
    }
    return config;
  }

  if (!config.password) {
    return config || null;
  }

  const migratedConfig = await withEncryptedWebDAVPassword(config, config.password);
  await chrome.storage.local.set({ [WEBDAV_CONFIG_STORAGE_KEY]: migratedConfig });
  return migratedConfig;
}

export async function saveLocalWebDAVConfigDraft(
  config: WebDAVConfigLike,
  password: string
): Promise<WebDAVConfigLike> {
  const updatedAt = Date.now();
  const syncedConfig = buildSyncedWebDAVConfig({ ...config, updatedAt }, updatedAt) || { updatedAt };
  const localConfig = await withEncryptedWebDAVPassword(syncedConfig, password);
  await chrome.storage.local.set({ [WEBDAV_CONFIG_STORAGE_KEY]: localConfig });
  return localConfig;
}

export async function saveWebDAVConfig(config: WebDAVConfigLike, password: string): Promise<WebDAVConfigLike> {
  const updatedAt = Date.now();
  const syncedConfig = buildSyncedWebDAVConfig({ ...config, updatedAt }, updatedAt) || { updatedAt };
  const localConfig = await withEncryptedWebDAVPassword(syncedConfig, password);

  await chrome.storage.local.set({ [WEBDAV_CONFIG_STORAGE_KEY]: localConfig });
  await setSyncedWebDAVConfig(syncedConfig);

  return localConfig;
}

export async function loadWebDAVConfig(): Promise<WebDAVConfigLike | null> {
  const [localResult, syncResult] = await Promise.all([
    chrome.storage.local.get([WEBDAV_CONFIG_STORAGE_KEY]),
    chrome.storage.sync.get([WEBDAV_CONFIG_STORAGE_KEY]).catch(() => ({ [WEBDAV_CONFIG_STORAGE_KEY]: undefined })),
  ]);

  const localConfig = await migratePlainWebDAVConfig(localResult[WEBDAV_CONFIG_STORAGE_KEY]);
  const syncedConfig = buildSyncedWebDAVConfig(syncResult[WEBDAV_CONFIG_STORAGE_KEY] as WebDAVConfigLike | undefined, 0);

  if (!localConfig && !syncedConfig) return null;

  if (localConfig && !syncedConfig) {
    const syncedFromLocal = buildSyncedWebDAVConfig(localConfig);
    if (!syncedFromLocal) return localConfig;

    const nextLocalConfig = { ...localConfig, updatedAt: syncedFromLocal.updatedAt };
    await chrome.storage.local.set({ [WEBDAV_CONFIG_STORAGE_KEY]: nextLocalConfig });
    await setSyncedWebDAVConfig(syncedFromLocal);
    return nextLocalConfig;
  }

  if (!localConfig && syncedConfig) {
    return syncedConfig;
  }

  const localUpdatedAt = toNumber(localConfig?.updatedAt) || 0;
  const syncedUpdatedAt = toNumber(syncedConfig?.updatedAt) || 0;

  if (syncedConfig && syncedUpdatedAt > localUpdatedAt) {
    const localWithoutStalePassword = hasCredentialTargetChanged(localConfig!, syncedConfig)
      ? omitPasswordFields(localConfig!)
      : localConfig!;
    const mergedConfig = { ...localWithoutStalePassword, ...syncedConfig };
    await chrome.storage.local.set({ [WEBDAV_CONFIG_STORAGE_KEY]: mergedConfig });
    return mergedConfig;
  }

  const syncedFromLocal = buildSyncedWebDAVConfig(localConfig, Date.now());
  if (syncedFromLocal && (!syncedConfig || localUpdatedAt > syncedUpdatedAt)) {
    await setSyncedWebDAVConfig(syncedFromLocal);
  }

  return localConfig;
}

export async function clearWebDAVConfig(): Promise<void> {
  await Promise.all([
    chrome.storage.local.remove([WEBDAV_CONFIG_STORAGE_KEY]),
    chrome.storage.sync.remove([WEBDAV_CONFIG_STORAGE_KEY]).catch(() => undefined),
  ]);
}
