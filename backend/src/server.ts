/**
 * 后端入口
 */
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = buildApp();

app.listen(env.PORT, () => {
  logger.info(
    `🌿 BookNook Backend ready on http://localhost:${env.PORT} (${env.NODE_ENV})`,
  );
});
