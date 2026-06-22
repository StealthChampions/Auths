import { OTPAlgorithm, OTPType } from '@/models/otp';
import { generateEntryHash, normalizeSecret } from '@/utils/accounts';

export interface AccountNormalizationResult {
  accounts: OTPEntryInterface[];
  invalidCount: number;
}

const MAX_TEXT_LENGTH = 256;
const MAX_ICON_LENGTH = 2048;

const OTP_TYPE_BY_NAME: Record<string, OTPType> = {
  totp: OTPType.totp,
  hotp: OTPType.hotp,
  battle: OTPType.battle,
  steam: OTPType.steam,
  hex: OTPType.hex,
  hhex: OTPType.hhex,
};

const OTP_ALGORITHM_BY_NAME: Record<string, OTPAlgorithm> = {
  SHA1: OTPAlgorithm.SHA1,
  SHA256: OTPAlgorithm.SHA256,
  SHA512: OTPAlgorithm.SHA512,
  GOST3411_2012_256: OTPAlgorithm.GOST3411_2012_256,
  GOST3411_2012_512: OTPAlgorithm.GOST3411_2012_512,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeOptionalText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  const text = normalizeText(value, maxLength);
  return text || undefined;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  const integer = Math.trunc(numericValue);
  if (integer < min || integer > max) return fallback;
  return integer;
}

function normalizeType(value: unknown): OTPType {
  if (typeof value === 'string') {
    const namedType = OTP_TYPE_BY_NAME[value.toLowerCase()];
    if (namedType) return namedType;
  }

  const numericType = normalizeInteger(value, OTPType.totp, OTPType.totp, OTPType.hhex);
  return OTP_TYPE_BY_NAME[OTPType[numericType]] ? numericType : OTPType.totp;
}

function normalizeAlgorithm(value: unknown): OTPAlgorithm {
  if (typeof value === 'string') {
    const namedAlgorithm = OTP_ALGORITHM_BY_NAME[value.toUpperCase()];
    if (namedAlgorithm) return namedAlgorithm;
  }

  const numericAlgorithm = normalizeInteger(
    value,
    OTPAlgorithm.SHA1,
    OTPAlgorithm.SHA1,
    OTPAlgorithm.GOST3411_2012_512
  );
  return OTPAlgorithm[numericAlgorithm] ? numericAlgorithm : OTPAlgorithm.SHA1;
}

function normalizeHash(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 128) : generateEntryHash();
}

function normalizeIcon(value: unknown): string | undefined {
  const icon = normalizeOptionalText(value, MAX_ICON_LENGTH);
  if (!icon) return undefined;

  if (/^https?:\/\//i.test(icon)) return icon;
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(icon)) return icon;
  return undefined;
}

function normalizeSecretValue(
  value: unknown,
  initialType: OTPType
): { secret: string; type: OTPType } | null {
  if (typeof value !== 'string') return null;

  let secret = normalizeSecret(value);
  if (!secret) return null;

  let type = initialType;
  const battleMatch = /^(?:BLZ-|BLIZ-)(.+)$/i.exec(secret);
  if (battleMatch) {
    secret = battleMatch[1];
    type = OTPType.battle;
  }

  const steamMatch = /^STM-(.+)$/i.exec(secret);
  if (steamMatch) {
    secret = steamMatch[1];
    type = OTPType.steam;
  }

  const isBase32 = /^[A-Z2-7]+=*$/.test(secret);
  const isHex = /^[0-9A-F]+$/.test(secret);

  if ((type === OTPType.hex || type === OTPType.hhex) && isHex) {
    return { secret, type };
  }

  if (!isBase32 && isHex && type === OTPType.totp) {
    return { secret, type: OTPType.hex };
  }

  if (!isBase32 && isHex && type === OTPType.hotp) {
    return { secret, type: OTPType.hhex };
  }

  if (isBase32) {
    return { secret, type };
  }

  return null;
}

export function normalizeAccount(value: unknown): OTPEntryInterface | null {
  if (!isRecord(value)) return null;

  const initialType = normalizeType(value.type);
  const normalizedSecret = normalizeSecretValue(value.secret, initialType);
  const encData = normalizeOptionalText(value.encData, MAX_ICON_LENGTH * 4);
  const encSecret = normalizeOptionalText(value.encSecret, MAX_ICON_LENGTH * 4);
  const keyId = normalizeOptionalText(value.keyId, 128);

  if (!normalizedSecret && !encData && !encSecret) return null;

  const type = normalizedSecret?.type ?? initialType;
  const account: OTPEntryInterface = {
    hash: normalizeHash(value.hash),
    issuer: normalizeText(value.issuer),
    account: normalizeText(value.account),
    code: normalizeText(value.code, 32),
    period: normalizeInteger(value.period, 30, 1, 300),
    pinned: normalizeBoolean(value.pinned),
    type,
    counter: normalizeInteger(value.counter, 0, 0, Number.MAX_SAFE_INTEGER),
    digits: normalizeInteger(value.digits, 6, 4, 10),
    secret: normalizedSecret?.secret ?? null,
    algorithm: normalizeAlgorithm(value.algorithm),
  };

  const index = normalizeInteger(value.index, -1, 0, Number.MAX_SAFE_INTEGER);
  if (index >= 0) account.index = index;

  const icon = normalizeIcon(value.icon);
  if (icon) account.icon = icon;

  const folder = normalizeOptionalText(value.folder);
  if (folder) account.folder = folder;

  if (encData) account.encData = encData;
  if (encSecret) account.encSecret = encSecret;
  if (keyId) account.keyId = keyId;

  return account;
}

export function normalizeAccountList(value: unknown): AccountNormalizationResult {
  if (!Array.isArray(value)) {
    return { accounts: [], invalidCount: 1 };
  }

  const accounts: OTPEntryInterface[] = [];
  let invalidCount = 0;

  for (const item of value) {
    const account = normalizeAccount(item);
    if (account) {
      accounts.push(account);
    } else {
      invalidCount += 1;
    }
  }

  return { accounts, invalidCount };
}
