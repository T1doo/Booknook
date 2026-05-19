/**
 * 后端入口
 *
 * 进程级错误兜底 (C11): unhandled rejection / uncaught exception 在 pino 中记录后
 * 受控退出, 避免进程进入未定义状态. 容器/PM2 会自动重启.
 */
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception, exiting');
  // 给日志输出留 100ms
  setTimeout(() => process.exit(1), 100);
});

const app = buildApp();

app.listen(env.PORT, () => {
  logger.info(
    `🌿 BookNook Backend ready on http://localhost:${env.PORT} (${env.NODE_ENV})`,
  );
});
