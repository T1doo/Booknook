/**
 * 集中读取并校验环境变量
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  PORT:            z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS:    z.string().default('http://localhost:3000'),
  // JWT_SECRET 强校验 (C1): 拒绝明显的模板默认值, 至少 32 字符
  JWT_SECRET:      z.string().min(32, 'JWT_SECRET 至少 32 个字符')
    .refine(
      (s) =>
        !/please[-_ ]?change/i.test(s) &&
        !/do[-_ ]?not[-_ ]?use/i.test(s) &&
        !/example|changeme|secret-here/i.test(s),
      'JWT_SECRET 不能使用模板/示例默认值, 请用 crypto.randomBytes 重新生成',
    ),
  JWT_EXPIRES_IN:  z.string().default('7d'),
  COOKIE_NAME:     z.string().default('booknook_token'),
  DATABASE_URL:    z.string().min(1),
  LOG_LEVEL:       z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  isDev: parsed.data.NODE_ENV === 'development',
};
