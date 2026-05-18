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
  JWT_SECRET:      z.string().min(16),
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
