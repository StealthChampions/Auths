import { dedupeAccountsBySecret, normalizeSecret } from '@/utils/accounts';

export interface BackupMergePreview {
  localCount: number;
  incomingCount: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  invalidCount: number;
  mergedCount: number;
  removedDuplicates: number;
  mergedAccounts: OTPEntryInterface[];
}

const COMPARED_ACCOUNT_FIELDS: Array<keyof OTPEntryInterface> = [
  'issuer',
  'account',
  'type',
  'counter',
  'period',
  'digits',
  'algorithm',
  'pinned',
  'icon',
  'folder',
  'encData',
  'encSecret',
  'keyId',
];

function comparableValue(account: OTPEntryInterface, field: keyof OTPEntryInterface) {
  const value = account[field];
  return value === undefined || value === null ? '' : value;
}

function accountsHaveMeaningfulDifference(local: OTPEntryInterface, incoming: OTPEntryInterface): boolean {
  if (normalizeSecret(local.secret) !== normalizeSecret(incoming.secret)) return true;

  return COMPARED_ACCOUNT_FIELDS.some((field) =>
    comparableValue(local, field) !== comparableValue(incoming, field)
  );
}

export function buildBackupMergePreview(
  localAccounts: OTPEntryInterface[],
  incomingAccounts: OTPEntryInterface[]
): BackupMergePreview {
  const localBySecret = new Map<string, OTPEntryInterface>();
  let invalidCount = 0;
  let newCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;

  for (const account of localAccounts) {
    const secret = normalizeSecret(account.secret);
    if (secret && !localBySecret.has(secret)) {
      localBySecret.set(secret, account);
    }
  }

  for (const account of incomingAccounts) {
    const secret = normalizeSecret(account.secret);
    if (!secret) {
      invalidCount += 1;
      continue;
    }

    const localAccount = localBySecret.get(secret);
    if (!localAccount) {
      newCount += 1;
    } else if (accountsHaveMeaningfulDifference(localAccount, account)) {
      updatedCount += 1;
    } else {
      duplicateCount += 1;
    }
  }

  const { accounts: mergedAccounts, removedDuplicates } = dedupeAccountsBySecret(
    [...localAccounts, ...incomingAccounts],
    { duplicatePreference: 'last' }
  );

  return {
    localCount: localAccounts.length,
    incomingCount: incomingAccounts.length,
    newCount,
    updatedCount,
    duplicateCount,
    invalidCount,
    mergedCount: mergedAccounts.length,
    removedDuplicates,
    mergedAccounts,
  };
}

export function normalizeBackupAccounts(accounts: OTPEntryInterface[]): OTPEntryInterface[] {
  return dedupeAccountsBySecret(accounts, { duplicatePreference: 'last' }).accounts;
}
