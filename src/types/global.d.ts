export {};

declare global {
  interface EncryptionInterface {
    decryptSecretString(secret: string): string | null;
    decryptEncSecret(entry: OTPEntryInterface): RawOTPStorage | null;
    getEncryptedString(data: string): string;
    getEncryptionStatus(): boolean;
    updateEncryptionPassword(password: string): void;
    setEncryptionKeyId(id: string): void;
    getEncryptionKeyId(): string;
    getSalt(): string;
  }

  interface OTPEntryInterface {
    hash: string;
    issuer: string;
    account: string;
    code: string;
    period: number;
    pinned: boolean;
    type: number;
    counter: number;
    digits: number;
    secret: string | null;
    algorithm: number;
    index?: number;
    icon?: string;
    folder?: string;
    encryption?: EncryptionInterface;
    encData?: string;
    encSecret?: string;
    keyId?: string;
  }

  interface OTPStorage {
    dataType?: string;
    encrypted?: boolean;
    hash?: string;
    index: number;
    type?: string;
    secret?: string;
    data?: string;
    keyId?: string;
    counter?: number;
    period?: number;
    issuer?: string;
    account?: string;
    digits?: number;
    algorithm?: string;
    pinned?: boolean;
    icon?: string;
    folder?: string;
  }

  interface RawOTPStorage extends OTPStorage {
    encrypted: boolean;
    hash: string;
    index: number;
    type: string;
    secret: string;
  }

  interface OldKey {
    enc: string;
    hash: string;
  }

  interface Key {
    dataType: "Key";
    id: string;
    salt: string;
    hash?: string;
    enc?: string;
  }
}
