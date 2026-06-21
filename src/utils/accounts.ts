export interface AccountLike {
  secret?: string | null;
  hash?: string;
  pinned?: boolean;
  [key: string]: unknown;
}

export interface DedupeAccountsOptions {
  duplicatePreference?: 'first' | 'last';
}

export function normalizeSecret(secret?: string | null): string {
  return secret ? secret.toUpperCase().replace(/\s/g, '') : '';
}

export function generateEntryHash(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function hasDuplicateSecret(entries: AccountLike[] | undefined, secret?: string | null): boolean {
  const normalizedSecret = normalizeSecret(secret);
  if (!normalizedSecret || !Array.isArray(entries)) return false;

  return entries.some((entry) => normalizeSecret(entry.secret) === normalizedSecret);
}

function mergeDuplicateAccount<T extends AccountLike>(
  existing: T,
  incoming: T,
  duplicatePreference: 'first' | 'last'
): T {
  const preferred = duplicatePreference === 'last' ? incoming : existing;
  const fallback = duplicatePreference === 'last' ? existing : incoming;
  const merged: AccountLike = { ...fallback };

  for (const [key, value] of Object.entries(preferred)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  // Keep the retained entry identity stable while still merging mutable fields.
  merged.hash = existing.hash;

  return merged as T;
}

export function dedupeAccountsBySecret<T extends AccountLike>(
  accounts: T[],
  options: DedupeAccountsOptions = {}
): { accounts: T[]; removedDuplicates: number } {
  const duplicatePreference = options.duplicatePreference ?? 'first';
  const seenSecrets = new Map<string, number>();
  const seenHashes = new Set<string>();
  const deduplicated: T[] = [];

  for (const account of accounts) {
    const normalizedSecret = normalizeSecret(account.secret);
    const existingIndex = normalizedSecret ? seenSecrets.get(normalizedSecret) : undefined;

    if (existingIndex !== undefined) {
      deduplicated[existingIndex] = mergeDuplicateAccount(
        deduplicated[existingIndex],
        account,
        duplicatePreference
      );
      continue;
    }

    const nextAccount = { ...account };
    if (!nextAccount.hash || seenHashes.has(nextAccount.hash)) {
      nextAccount.hash = generateEntryHash();
    }

    if (normalizedSecret) seenSecrets.set(normalizedSecret, deduplicated.length);
    seenHashes.add(nextAccount.hash);
    deduplicated.push(nextAccount);
  }

  return {
    accounts: deduplicated,
    removedDuplicates: accounts.length - deduplicated.length,
  };
}
