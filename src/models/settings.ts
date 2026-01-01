/**
 * Settings Module | 设置模块
 *
 * Manages user settings with support for both local and sync storage.
 * Handles theme, language, zoom, smart filter, and other preferences.
 *
 * 管理用户设置，支持本地存储和同步存储。
 * 处理主题、语言、缩放、智能过滤等偏好设置。
 */

// Storage Location Enum | 存储位置枚举
export enum StorageLocation {
  Sync = "sync",
  Local = "local",
}

interface UserSettingsData {
  // Local settings | 本地设置
  lastRemindingBackupTime?: number;
  offset?: number;
  storageLocation?: StorageLocation;
  webdavConfigured?: boolean;

  // Syncable settings | 可同步设置
  autolock?: number;
  encodedPhrase?: string;
  smartFilter?: boolean;
  theme?: string;
  themeColor?: string;
  zoom?: number;
  language?: string;
}

// Local-only settings keys | 仅本地设置的键名
const LocalUserSettingsDataKeys = [
  "lastRemindingBackupTime",
  "offset",
  "storageLocation",
  "webdavConfigured",
];

export class UserSettings {
  static items: UserSettingsData = {};

  static async updateItems() {
    UserSettings.items = await UserSettings.getAllItems();
  }

  static async convertFromLocalStorage(
    data: Storage,
    location: StorageLocation
  ) {
    const settings: UserSettingsData = {};

    for (const key in data) {
      if (isBooleanOption(key)) {
        settings[key] = data[key] === "true";
      } else if (isNumberOption(key)) {
        settings[key] = Number(data[key]);
      } else {
        settings[key as keyof UserSettingsData] = data[key];
      }
    }

    settings.storageLocation = location;
    UserSettings.items = settings;
    await UserSettings.commitItems();
  }

  static async commitItems() {
    const storageLocation =
      UserSettings.items.storageLocation || StorageLocation.Local;

    if (storageLocation === StorageLocation.Local) {
      await chrome.storage[storageLocation].set({
        // JSON.parse(JSON.stringify()) strips functions (e.g. getItem, setItem, ...) which may have been added to the object.
        // Without this, a crash may occur as chrome.storage throws an error when trying to serialize a function.
        UserSettings: JSON.parse(JSON.stringify(UserSettings.items)),
      });
    } else {
      const { syncableSettings, localSettings } = UserSettings.splitSettings(
        UserSettings.items
      );

      await Promise.all([
        chrome.storage[StorageLocation.Local].set({
          UserSettings: JSON.parse(JSON.stringify(localSettings)),
        }),
        chrome.storage[StorageLocation.Sync].set({
          UserSettings: JSON.parse(JSON.stringify(syncableSettings)),
        }),
      ]);
    }

    await UserSettings.updateItems();
  }

  static async removeItem(key: keyof UserSettingsData) {
    const localSettings = await UserSettings.getStorageData(
      StorageLocation.Local
    );
    const storageLocation =
      localSettings.storageLocation || StorageLocation.Local;

    const location = LocalUserSettingsDataKeys.includes(key)
      ? StorageLocation.Local
      : storageLocation;
    const storageData: UserSettingsData =
      (await chrome.storage[location].get("UserSettings"))?.UserSettings || {};
    delete storageData[key];

    UserSettings.items = storageData;

    await UserSettings.commitItems();
  }

  private static async getStorageData(location: StorageLocation) {
    const storageData: UserSettingsData =
      (await chrome.storage[location].get("UserSettings"))?.UserSettings || {};

    return storageData;
  }

  private static splitSettings(storageData: UserSettingsData) {
    const syncableSettings: UserSettingsData = Object.assign({}, storageData);
    const localSettings: UserSettingsData = Object.assign({}, storageData);

    let key: keyof UserSettingsData;
    for (key in storageData) {
      if (LocalUserSettingsDataKeys.includes(key)) {
        delete syncableSettings[key];
      } else {
        delete localSettings[key];
      }
    }

    return {
      syncableSettings,
      localSettings,
    };
  }

  private static async getAllItems() {
    const localSettings = await UserSettings.getStorageData(
      StorageLocation.Local
    );
    const storageLocation =
      localSettings.storageLocation || StorageLocation.Local;

    if (storageLocation === StorageLocation.Local) {
      return localSettings;
    }

    const syncableSettings = await UserSettings.getStorageData(
      StorageLocation.Sync
    );
    return { ...syncableSettings, ...localSettings };
  }
}

type BooleanOption = "smartFilter" | "webdavConfigured";

type NumberOption = "autolock" | "lastRemindingBackupTime" | "offset" | "zoom";

function isBooleanOption(key: string): key is BooleanOption {
  return ["smartFilter", "webdavConfigured"].includes(key);
}

function isNumberOption(key: string): key is NumberOption {
  return ["autolock", "lastRemindingBackupTime", "offset", "zoom"].includes(
    key
  );
}


