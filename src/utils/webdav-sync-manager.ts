import { dedupeAccountsBySecret } from '@/utils/accounts';
import { buildBackupMergePreview, normalizeBackupAccounts, type BackupMergePreview } from '@/utils/backup-preview';
import { downloadWebDAVBackup, getLatestWebDAVBackup, uploadWebDAVBackup } from '@/utils/webdav-sync';

export type WebDAVSyncStatus = 'uploaded' | 'downloaded' | 'up_to_date' | 'empty' | 'conflict';
export type WebDAVSyncConflictResolution = 'merge' | 'local' | 'remote';

export interface WebDAVSyncConflict {
  remoteFileName: string;
  remoteTimestamp: number;
  remoteAccounts: OTPEntryInterface[];
  localAccounts: OTPEntryInterface[];
  summary: BackupMergePreview;
}

export interface WebDAVSyncResult {
  status: WebDAVSyncStatus;
  filename?: string;
  summary?: BackupMergePreview;
  removedDuplicates?: number;
  conflict?: WebDAVSyncConflict;
}

interface WebDAVSyncOptions {
  serverUrl: string;
  username: string;
  password: string;
  onEntriesChanged?: (entries: OTPEntryInterface[]) => void | Promise<void>;
}

interface LocalSyncState {
  entries: OTPEntryInterface[];
  entriesLastModified: number;
  lastSyncedTimestamp: number;
}

async function loadLocalSyncState(): Promise<LocalSyncState> {
  const result = await chrome.storage.local.get(['entries', 'entriesLastModified', 'lastSyncedTimestamp']);
  return {
    entries: Array.isArray(result.entries) ? result.entries : [],
    entriesLastModified: Number(result.entriesLastModified || 0),
    lastSyncedTimestamp: Number(result.lastSyncedTimestamp || 0),
  };
}

async function saveEntries(
  entries: OTPEntryInterface[],
  timestamp: number,
  onEntriesChanged?: WebDAVSyncOptions['onEntriesChanged']
) {
  await chrome.storage.local.set({
    entries,
    entriesLastModified: timestamp,
  });
  await onEntriesChanged?.(entries);
}

async function saveLastSynced(timestamp: number) {
  await chrome.storage.local.set({ lastSyncedTimestamp: timestamp });
}

async function uploadLocalEntries(
  options: WebDAVSyncOptions,
  entries: OTPEntryInterface[]
): Promise<{ filename: string; removedDuplicates: number }> {
  const {
    accounts: deduplicatedEntries,
    removedDuplicates,
  } = dedupeAccountsBySecret(entries);
  const timestamp = Date.now();

  if (removedDuplicates > 0) {
    await saveEntries(deduplicatedEntries, timestamp, options.onEntriesChanged);
  } else {
    await chrome.storage.local.set({ entriesLastModified: timestamp });
  }

  const filename = await uploadWebDAVBackup(
    options.serverUrl,
    options.username,
    options.password,
    deduplicatedEntries
  );
  await saveLastSynced(timestamp);

  return { filename, removedDuplicates };
}

async function downloadAndMergeRemote(
  options: WebDAVSyncOptions,
  filename: string,
  localEntries: OTPEntryInterface[]
): Promise<{ summary: BackupMergePreview }> {
  const backupData = await downloadWebDAVBackup<OTPEntryInterface>(
    options.serverUrl,
    options.username,
    options.password,
    filename
  );
  const summary = buildBackupMergePreview(localEntries, backupData.accounts);
  const timestamp = Date.now();

  await saveEntries(summary.mergedAccounts, timestamp, options.onEntriesChanged);
  await saveLastSynced(timestamp);

  return { summary };
}

export async function runWebDAVSync(options: WebDAVSyncOptions): Promise<WebDAVSyncResult> {
  const localState = await loadLocalSyncState();
  const latestRemote = await getLatestWebDAVBackup(options.serverUrl, options.username, options.password);

  if (!latestRemote) {
    if (localState.entries.length === 0) {
      await saveLastSynced(Date.now());
      return { status: 'empty' };
    }

    const uploadResult = await uploadLocalEntries(options, localState.entries);
    return {
      status: 'uploaded',
      filename: uploadResult.filename,
      removedDuplicates: uploadResult.removedDuplicates,
    };
  }

  if (
    latestRemote.timestamp > localState.lastSyncedTimestamp &&
    localState.entriesLastModified > localState.lastSyncedTimestamp &&
    localState.entries.length > 0
  ) {
    const backupData = await downloadWebDAVBackup<OTPEntryInterface>(
      options.serverUrl,
      options.username,
      options.password,
      latestRemote.name
    );
    return {
      status: 'conflict',
      conflict: {
        remoteFileName: latestRemote.name,
        remoteTimestamp: backupData.timestamp || latestRemote.timestamp,
        remoteAccounts: backupData.accounts,
        localAccounts: localState.entries,
        summary: buildBackupMergePreview(localState.entries, backupData.accounts),
      },
    };
  }

  if (localState.entriesLastModified === 0 && localState.entries.length === 0) {
    const downloadResult = await downloadAndMergeRemote(options, latestRemote.name, localState.entries);
    return {
      status: 'downloaded',
      filename: latestRemote.name,
      summary: downloadResult.summary,
    };
  }

  if (latestRemote.timestamp > localState.entriesLastModified) {
    const downloadResult = await downloadAndMergeRemote(options, latestRemote.name, localState.entries);
    return {
      status: 'downloaded',
      filename: latestRemote.name,
      summary: downloadResult.summary,
    };
  }

  if (localState.entriesLastModified > latestRemote.timestamp) {
    const uploadResult = await uploadLocalEntries(options, localState.entries);
    return {
      status: 'uploaded',
      filename: uploadResult.filename,
      removedDuplicates: uploadResult.removedDuplicates,
    };
  }

  await saveLastSynced(Date.now());
  return { status: 'up_to_date' };
}

export async function resolveWebDAVSyncConflict(
  options: WebDAVSyncOptions,
  conflict: WebDAVSyncConflict,
  resolution: WebDAVSyncConflictResolution
): Promise<{ entries: OTPEntryInterface[]; filename?: string }> {
  let nextEntries: OTPEntryInterface[];

  if (resolution === 'merge') {
    nextEntries = conflict.summary.mergedAccounts;
  } else if (resolution === 'local') {
    nextEntries = normalizeBackupAccounts(conflict.localAccounts);
  } else {
    nextEntries = normalizeBackupAccounts(conflict.remoteAccounts);
  }

  const timestamp = Date.now();
  await saveEntries(nextEntries, timestamp, options.onEntriesChanged);

  let filename: string | undefined;
  if (resolution !== 'remote') {
    filename = await uploadWebDAVBackup(
      options.serverUrl,
      options.username,
      options.password,
      nextEntries
    );
  }

  await saveLastSynced(timestamp);
  return { entries: nextEntries, filename };
}
