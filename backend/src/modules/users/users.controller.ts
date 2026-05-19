/**
 * 用户管理模块 (仅超级管理员可访问)
 *
 * 实现 PPT 要求:
 *   - 超管可创建普通管理员
 *   - 超管可查看所有用户
 *   - 超管可禁用/启用用户
 *   - 超管可重置密码
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ok, created, Err } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authRequired } from '../../middlewares/auth.js';
import { requireSuperAdmin } from '../../middlewares/rbac.js';
import { genSalt, md5Hash } from '../../utils/md5.js';

const router = Router();
router.use(authRequired, requireSuperAdmin);

const createUserSchema = z.object({
  username:    z.string().min(3).max(32).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, '用户名需以字母开头'),
  password:    z.string().min(6).max(128),
  real_name:   z.string().min(1).max(32),
  employee_no: z.string().min(1).max(16),
  gender:      z.enum(['male', 'female', 'other']).default('other'),
  age:         z.number().int().min(16).max(100).optional(),
  role:        z.enum(['super_admin', 'admin']).default('admin'),
});

const updateUserSchema = z.object({
  real_name:   z.string().min(1).max(32).optional(),
  employee_no: z.string().min(1).max(16).optional(),
  gender:      z.enum(['male', 'female', 'other']).optional(),
  age:         z.number().int().min(16).max(100).optional(),
  role:        z.enum(['super_admin', 'admin']).optional(),
  is_active:   z.boolean().optional(),
  password:    z.string().min(6).max(128).optional(),
});

const listQuerySchema = z.object({
  q:    z.string().optional(),
  role: z.enum(['super_admin', 'admin']).optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /users
router.get('/', validate('query', listQuerySchema), async (req, res) => {
  const { q, role, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;

  const where = {
    AND: [
      role ? { role } : {},
      q
        ? {
            OR: [
              { username:    { contains: q, mode: 'insensitive' as const } },
              { real_name:   { contains: q } },
              { employee_no: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {},
    ],
  };
  const [total, list] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, username: true, real_name: true, employee_no: true,
        gender: true, age: true, role: true, is_active: true,
        created_at: true, last_login_at: true,
      },
    }),
  ]);
  ok(res, { total, page, pageSize, list });
});

// POST /users
router.post('/', validate('body', createUserSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createUserSchema>;

  const dup = await prisma.user.findFirst({
    where: { OR: [{ username: body.username }, { employee_no: body.employee_no }] },
  });
  if (dup) throw Err.conflict('用户名或工号已存在');

  const salt = genSalt();
  const user = await prisma.user.create({
    data: {
      username:      body.username,
      password_hash: md5Hash(body.password, salt),
      salt,
      real_name:     body.real_name,
      employee_no:   body.employee_no,
      gender:        body.gender,
      age:           body.age,
      role:          body.role,
    },
    select: {
      id: true, username: true, real_name: true, employee_no: true,
      role: true, gender: true, age: true, is_active: true, created_at: true,
    },
  });
  created(res, user, '已创建');
});

// PATCH /users/:id
// F6: 改用 validate 中间件, 错误信息与其他路由统一格式
router.patch('/:id', validate('body', updateUserSchema), async (req, res) => {
  const id = BigInt(req.params.id as string);
  const body = req.body as z.infer<typeof updateUserSchema>;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw Err.notFound();

  const data: Record<string, unknown> = {};
  if (body.real_name)   data.real_name = body.real_name;
  if (body.employee_no) data.employee_no = body.employee_no;
  if (body.gender)      data.gender = body.gender;
  if (body.age != null) data.age = body.age;
  if (body.role)        data.role = body.role;
  if (body.is_active != null) data.is_active = body.is_active;
  if (body.password) data.password_hash = md5Hash(body.password, target.salt);

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, username: true, real_name: true, employee_no: true,
      role: true, gender: true, age: true, is_active: true,
    },
  });
  ok(res, updated, '已更新');
});

// DELETE /users/:id (软删除 = is_active=false; 真删除有外键风险)
router.delete('/:id', async (req, res) => {
  const id = BigInt(req.params.id);
  if (id.toString() === req.user!.uid) throw Err.badRequest('不能删除自己');
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw Err.notFound();

  // C12: 禁用最后一个超管会让系统失去管理入口, 拒绝.
  if (target.role === 'super_admin' && target.is_active) {
    const remainingSuperAdmins = await prisma.user.count({
      where: { role: 'super_admin', is_active: true, id: { not: id } },
    });
    if (remainingSuperAdmins === 0) {
      throw Err.badRequest('不能停用最后一个超级管理员');
    }
  }

  await prisma.user.update({ where: { id }, data: { is_active: false } });
  ok(res, null, '已停用');
});

export default router;
