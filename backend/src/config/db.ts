/**
 * Prisma 客户端单例
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * BigInt 序列化为字符串,避免 JSON.stringify 报错
 * 客户端在 BigInt 列上接到 string,需要时再转 number/BigInt
 */
// @ts-expect-error - 给 BigInt 原型注入 toJSON
BigInt.prototype.toJSON = function () {
  return this.toString();
};
