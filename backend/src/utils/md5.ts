/**
 * MD5 密码哈希工具
 * 协议: hash = md5(password || salt), salt = 12 字节随机 → 24 hex
 *
 * 注: PPT 明确要求 MD5 算法。MD5 在密码学上不安全,
 *     生产环境应使用 bcrypt/argon2,此处加 salt 提升基础安全性,
 *     并在实验报告中讨论该权衡。
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 生成 12 字节随机 salt,返回 24 位十六进制字符串 */
export function genSalt(): string {
  return randomBytes(12).toString('hex');
}

/** 计算 md5(password || salt) */
export function md5Hash(password: string, salt: string): string {
  return createHash('md5').update(password + salt, 'utf8').digest('hex');
}

/**
 * 常量时间比较,避免 timing attack
 */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = md5Hash(password, salt);
  if (actual.length !== expectedHash.length) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expectedHash, 'hex'));
}
