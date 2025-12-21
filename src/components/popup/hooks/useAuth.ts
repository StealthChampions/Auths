import { useState, useEffect } from 'react';
import { EntryStorage } from '../../../models/storage';
import { Encryption } from '../../../models/encryption';
import { verifyPasswordUsingKeyID } from '../../../models/password';

export function useAuth() {
  const [isLocked, setIsLocked] = useState(true);
  const [encryption, setEncryption] = useState<Encryption | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPasswordStatus();
  }, []);

  const checkPasswordStatus = async () => {
    try {
      const hasKey = await EntryStorage.hasEncryptionKey();
      setHasPassword(hasKey);
      if (!hasKey) {
        setIsLocked(false);
        setEncryption(new Encryption('', ''));
      }
    } catch (error) {
      console.error('Failed to check password status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unlock = async (password: string): Promise<boolean> => {
    try {
      // For now, create a simple encryption instance
      // TODO: Implement proper key verification
      const enc = new Encryption(password, 'default');
      setEncryption(enc);
      setIsLocked(false);
      return true;
    } catch (error) {
      console.error('Failed to unlock:', error);
      return false;
    }
  };

  const lock = () => {
    setIsLocked(true);
    setEncryption(null);
  };

  return {
    isLocked,
    hasPassword,
    encryption,
    isLoading,
    unlock,
    lock,
    checkPasswordStatus,
  };
}
