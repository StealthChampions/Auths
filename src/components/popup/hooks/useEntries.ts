import { useState, useEffect, useCallback } from 'react';
import { OTPEntry } from '../../../models/otp';
import { EntryStorage } from '../../../models/storage';
import { Encryption } from '../../../models/encryption';

export interface DisplayEntry {
  hash: string;
  issuer: string;
  account: string;
  code: string;
  period: number;
  pinned: boolean;
  type: number;
  counter?: number;
}

export function useEntries(encryption: Encryption | null) {
  const [entries, setEntries] = useState<OTPEntry[]>([]);
  const [displayEntries, setDisplayEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (encryption) {
      loadEntries();
    }
  }, [encryption]);

  useEffect(() => {
    // Update codes every second
    const interval = setInterval(() => {
      updateCodes();
    }, 1000);

    return () => clearInterval(interval);
  }, [entries]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const loadedEntries = await EntryStorage.get();

      // Apply encryption if available
      if (encryption && encryption.getEncryptionStatus()) {
        loadedEntries.forEach(entry => {
          if (entry.encData || entry.encSecret) {
            entry.applyEncryption(encryption);
          }
        });
      }

      setEntries(loadedEntries);
      updateDisplayEntries(loadedEntries);
      setError('');
    } catch (err) {
      console.error('Failed to load entries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const updateCodes = () => {
    entries.forEach(entry => {
      if (entry.type !== 2 && entry.type !== 6) { // Not HOTP or HHEX
        entry.generate();
      }
    });
    updateDisplayEntries(entries);
  };

  const updateDisplayEntries = (otpEntries: OTPEntry[]) => {
    const display: DisplayEntry[] = otpEntries.map(entry => ({
      hash: entry.hash,
      issuer: entry.issuer,
      account: entry.account,
      code: entry.code,
      period: entry.period,
      pinned: entry.pinned,
      type: entry.type,
      counter: entry.counter,
    }));

    // Sort: pinned first, then by index
    display.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    setDisplayEntries(display);
  };

  const addEntry = async (data: {
    issuer: string;
    account: string;
    secret: string;
    type?: number;
    period?: number;
    digits?: number;
  }) => {
    try {
      const entry = new OTPEntry(
        {
          issuer: data.issuer,
          account: data.account,
          secret: data.secret,
          type: data.type || 1, // Default to TOTP
          encrypted: encryption?.getEncryptionStatus() || false,
          index: entries.length,
          period: data.period || 30,
          digits: data.digits || 6,
        },
        encryption || undefined
      );

      if (encryption && encryption.getEncryptionStatus()) {
        entry.changeEncryption(encryption);
      }

      await entry.create();
      await loadEntries();
      return true;
    } catch (err) {
      console.error('Failed to add entry:', err);
      throw err;
    }
  };

  const deleteEntry = async (hash: string) => {
    try {
      const entry = entries.find(e => e.hash === hash);
      if (entry) {
        await entry.delete();
        await loadEntries();
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
      throw err;
    }
  };

  const togglePin = async (hash: string) => {
    try {
      const entry = entries.find(e => e.hash === hash);
      if (entry) {
        entry.pinned = !entry.pinned;
        await entry.update();
        await loadEntries();
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      throw err;
    }
  };

  const updateEntry = async (
    hash: string,
    data: { issuer?: string; account?: string }
  ) => {
    try {
      const entry = entries.find(e => e.hash === hash);
      if (entry) {
        if (data.issuer !== undefined) entry.issuer = data.issuer;
        if (data.account !== undefined) entry.account = data.account;
        await entry.update();
        await loadEntries();
      }
    } catch (err) {
      console.error('Failed to update entry:', err);
      throw err;
    }
  };

  const nextCode = async (hash: string) => {
    try {
      const entry = entries.find(e => e.hash === hash);
      if (entry && (entry.type === 2 || entry.type === 6)) {
        // HOTP or HHEX
        await entry.next();
        await loadEntries();
      }
    } catch (err) {
      console.error('Failed to generate next code:', err);
      throw err;
    }
  };

  return {
    entries: displayEntries,
    loading,
    error,
    addEntry,
    deleteEntry,
    togglePin,
    updateEntry,
    nextCode,
    reload: loadEntries,
  };
}
