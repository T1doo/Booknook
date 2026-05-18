/**
 * Express App 装配
 */
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { authRequired } from './middlewares/auth.js';
import { auditLog } from './middlewares/audit.js';

import authRouter         from './modules/auth/auth.controller.js';
import usersRouter        from './modules/users/users.controller.js';
import booksRouter        from './modules/books/books.controller.js';
import purchasesRouter    from './modules/purchases/purchases.controller.js';
import salesRouter        from './modules/sales/sales.controller.js';
import transactionsRouter from './modules/transactions/transactions.controller.js';
import analyticsRouter    from './modules/analytics/analytics.controller.js';
import alertsRouter       from './modules/alerts/alerts.controller.js';
import logsRouter         from './modules/logs/logs.controller.js';
import reportsRouter      from './modules/reports/reports.controller.js';

export function buildApp() {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.set('trust proxy', 1);

  // 健康检查
  app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // 不需登录: 登录 / 登出
  app.use('/api/auth', authRouter);

  // 以下路由全部需登录 + 审计
  app.use('/api', authRequired, auditLog);

  app.use('/api/users',        usersRouter);
  app.use('/api/books',        booksRouter);
  app.use('/api/purchases',    purchasesRouter);
  app.use('/api/sales',        salesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/analytics',    analyticsRouter);
  app.use('/api/alerts',       alertsRouter);
  app.use('/api/logs',         logsRouter);
  app.use('/api/reports',      reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
