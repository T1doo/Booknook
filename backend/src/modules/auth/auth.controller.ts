/**
 * 认证模块 · 登录 / 登出 / 当前用户信息
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { signToken } from '../../utils/jwt.js';
import { verifyPassword, md5Hash } from '../../utils/md5.js';
import { ok, Err } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authRequired } from '../../middlewares/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

// C4: 登录速率限制, 15 分钟内同一 IP 最多 20 次尝试.
//     字典攻击场景下大幅抬高破解成本; 正常用户绝不会触发.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 4029, data: null, message: '尝试过于频繁,请 15 分钟后再试' },
});

// ────────────────── POST /auth/login ────────────────────────────────────────
router.post('/login', loginLimiter, validate('body', loginSchema), async (req: Request, res: Response) => {
  const { username, password } = req.body as z.infer<typeof loginSchema>;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.is_active) throw Err.unauthorized('用户名或密码错误');
  if (!verifyPassword(password, user.salt, user.password_hash)) {
    throw Err.unauthorized('用户名或密码错误');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const token = signToken({ uid: user.id.toString(), username: user.username, role: user.role });

  // HttpOnly cookie 是 token 的唯一权威载体 (C6).
  // - sameSite=strict + path=/api 进一步收窄 CSRF 攻击面
  // - 不再把 token 放在响应 body 让前端存 localStorage, 避免 XSS 后被偷
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: !env.isDev,
    sameSite: 'strict',
    path: '/api',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ok(res, {
    user: {
      id: user.id.toString(),
      username: user.username,
      real_name: user.real_name,
      employee_no: user.employee_no,
      role: user.role,
      gender: user.gender,
      age: user.age,
    },
  });
});

// ────────────────── POST /auth/logout ───────────────────────────────────────
router.post('/logout', (_req, res) => {
  // clearCookie 必须匹配 set 时的 path, 否则浏览器不会清除
  res.clearCookie(env.COOKIE_NAME, { path: '/api' });
  ok(res, null, '已登出');
});

// ────────────────── GET /auth/me ────────────────────────────────────────────
router.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(req.user!.uid) },
    select: {
      id: true, username: true, real_name: true, employee_no: true,
      role: true, gender: true, age: true, is_active: true,
      created_at: true, last_login_at: true,
    },
  });
  if (!user) throw Err.notFound('用户不存在');
  ok(res, user);
});

// ────────────────── PATCH /auth/me ──────────────────────────────────────────
const updateMeSchema = z.object({
  real_name:        z.string().min(1).max(32).optional(),
  gender:           z.enum(['male', 'female', 'other']).optional(),
  age:              z.number().int().min(16).max(100).optional(),
  password:         z.string().min(6).max(128).optional(),
  current_password: z.string().min(1).max(128).optional(),
});

router.patch('/me', authRequired, validate('body', updateMeSchema), async (req, res) => {
  const body = req.body as z.infer<typeof updateMeSchema>;
  const data: Record<string, unknown> = {};
  if (body.real_name) data.real_name = body.real_name;
  if (body.gender)    data.gender = body.gender;
  if (body.age != null) data.age = body.age;
  if (body.password) {
    if (!body.current_password) throw Err.badRequest('请输入原密码');
    const user = await prisma.user.findUnique({ where: { id: BigInt(req.user!.uid) } });
    if (!user) throw Err.notFound();
    if (!verifyPassword(body.current_password, user.salt, user.password_hash)) {
      throw Err.badRequest('原密码错误');
    }
    data.password_hash = md5Hash(body.password, user.salt);
  }
  await prisma.user.update({ where: { id: BigInt(req.user!.uid) }, data });
  ok(res, null, '已更新');
});

export default router;
