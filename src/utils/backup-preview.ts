import { dedupeAccountsBySecret, normalizeSecret } from '@/utils/accounts';
import { normalizeAccountList } from '@/utils/account-normalization';

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
  const normalizedLocal = normalizeAccountList(localAccounts);
  const normalizedIncoming = normalizeAccountList(incomingAccounts);
  const localBySecret = new Map<string, OTPEntryInterface>();
  let invalidCount = normalizedIncoming.invalidCount;
  let newCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;

  for (const account of normalizedLocal.accounts) {
    const secret = normalizeSecret(account.secret);
    if (secret && !localBySecret.has(secret)) {
      localBySecret.set(secret, account);
    }
  }

  for (const account of normalizedIncoming.accounts) {
    const secret = normalizeSecret(account.secret);
    if (!secret) {
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
    [...normalizedLocal.accounts, ...normalizedIncoming.accounts],
    { duplicatePreference: 'last' }
  );

  return {
    localCount: normalizedLocal.accounts.length,
    incomingCount: normalizedIncoming.accounts.length,
    newCount,
    updatedCount,
    duplicateCount,
    invalidCount,
    mergedCount: mergedAccounts.length,
    removedDuplicates,
    mergedAccounts,
  };
}

export function normalizeBackupAccounts(accounts: unknown): OTPEntryInterface[] {
  const normalized = normalizeAccountList(accounts);
  return dedupeAccountsBySecret(normalized.accounts, { duplicatePreference: 'last' }).accounts;
}
