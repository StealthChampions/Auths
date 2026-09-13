/**
 * OTP Module | OTP 模块
 *
 * Defines OTP types and supported hash algorithms.
 * Supports TOTP, HOTP, Steam, Battle.net and other formats.
 *
 * 定义 OTP 类型与支持的哈希算法。
 * 支持 TOTP、HOTP、Steam、Battle.net 等格式。
 */

// OTP Type Enum | OTP 类型枚举
export enum OTPType {
  totp = 1,
  hotp,
  battle,
  steam,
  hex,
  hhex,
}

export enum OTPAlgorithm {
  SHA1 = 1,
  SHA256,
  SHA512,
  GOST3411_2012_256,
  GOST3411_2012_512,
}

export interface OTPAlgorithmSpec {
  length: number;
}

export class OTPUtil {
  static getOTPAlgorithmSpec(otpAlgorithm: OTPAlgorithm): OTPAlgorithmSpec {
    switch (otpAlgorithm) {
      case OTPAlgorithm.GOST3411_2012_256:
        return { length: 256 };
      case OTPAlgorithm.GOST3411_2012_512:
        return { length: 512 };
      default:
        return { length: 0 };
    }
  }
}