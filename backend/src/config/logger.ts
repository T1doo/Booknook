/**
 * Pino 结构化日志,开发环境用 pino-pretty 美化输出
 */
import { pino } from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
