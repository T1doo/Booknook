'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Users, Pencil, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/layout/pagination';
import { EmptyState } from '@/components/empty-state';
import { RoleGuard } from '@/components/layout/auth-gate';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { useT } from '@/i18n';

type User = {
  id: string; username: string; real_name: string; employee_no: string;
  gender: 'male' | 'female' | 'other'; age: number | null;
  role: 'super_admin' | 'admin'; is_active: boolean;
  created_at: string; last_login_at: string | null;
};

const PAGE_SIZE = 15;

export default function UsersPage() {
  // D2: 仅超管可访问. 普通管理员手输 /users 会自动 replace 到 /dashboard.
  return (
    <RoleGuard requiredRole="super_admin">
      <UsersPageInner />
    </RoleGuard>
  );
}

function UsersPageInner() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ total: number; list: User[] } | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async () => {
    const r = await api.get<{ total: number; list: User[] }>(
      `/users?page=${page}&pageSize=${PAGE_SIZE}` + (q ? `&q=${encodeURIComponent(q)}` : ''),
    );
    setData(r);
  }, [page, q]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const toggleActive = async (u: User) => {
    try {
      if (u.is_active) {
        if (!confirm(`停用账号 ${u.username}?`)) return;
        await api.delete(`/users/${u.id}`);
      } else {
        await api.patch(`/users/${u.id}`, { is_active: true });
      }
      toast.success('操作成功');
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div>
      <PageHeader
        title={t('user.title_page')}
        description={t('user.desc_page')}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />{t('user.new_button')}
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        <Input className="max-w-sm" placeholder={t('user.search_placeholder')}
               value={q} onChange={(e) => setQ(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchList(); } }} />
        <Button onClick={() => { setPage(1); fetchList(); }}>{t('common.search')}</Button>
      </div>

      {!data ? (
        <Skeleton className="h-64" />
      ) : data.total === 0 ? (
        <EmptyState icon={Users} title={t('user.empty')} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('common.id')}</TableHead>
                <TableHead>{t('user.username')}</TableHead>
                <TableHead>{t('user.real_name')}</TableHead>
                <TableHead>{t('user.employee_no')}</TableHead>
                <TableHead>{t('user.role')}</TableHead>
                <TableHead>{t('user.gender_age')}</TableHead>
                <TableHead>{t('user.status')}</TableHead>
                <TableHead>{t('user.last_login')}</TableHead>
                <TableHead className="text-right">{t('common.operations')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-muted-foreground tabular">{u.id}</TableCell>
                  <TableCell className="font-mono">{u.username}</TableCell>
                  <TableCell className="font-medium">{u.real_name}</TableCell>
                  <TableCell>{u.employee_no}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'super_admin' ? 'default' : 'muted'}>
                      {u.role === 'super_admin' ? t('user.role_super') : t('user.role_admin')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.gender === 'male' ? t('user.gender_male') : u.gender === 'female' ? t('user.gender_female') : '—'} · {u.age ?? '—'}
                  </TableCell>
                  <TableCell>
                    {u.is_active ? <Badge variant="success">{t('user.active')}</Badge> : <Badge variant="destructive">{t('user.inactive')}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.last_login_at ? formatDate(u.last_login_at) : '—'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)}>
                      <Pencil className="size-4" />
                    </Button>
                    {u.id !== me?.id && (
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(u)}>
                        {u.is_active ? <ShieldOff className="size-4 text-destructive" /> : <ShieldCheck className="size-4 text-emerald-600" />}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}

      <UserDialog
        mode={creating ? 'create' : (editing ? 'edit' : 'none')}
        user={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); fetchList(); }}
      />
    </div>
  );
}

function UserDialog({
  mode, user, onClose, onSaved,
}: {
  mode: 'create' | 'edit' | 'none';
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = mode !== 'none';
  const isCreate = mode === 'create';

  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [realName, setRealName]       = useState('');
  const [employeeNo, setEmployeeNo]   = useState('');
  const [gender, setGender]           = useState<'male' | 'female' | 'other'>('other');
  const [age, setAge]                 = useState('');
  const [role, setRole]               = useState<'super_admin' | 'admin'>('admin');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isCreate) {
      setUsername(''); setPassword(''); setRealName(''); setEmployeeNo('');
      setGender('other'); setAge(''); setRole('admin');
    } else if (user) {
      setUsername(user.username);
      setPassword('');
      setRealName(user.real_name);
      setEmployeeNo(user.employee_no);
      setGender(user.gender);
      setAge(user.age?.toString() ?? '');
      setRole(user.role);
    }
  }, [isCreate, user]);

  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        real_name: realName, employee_no: employeeNo, gender, role,
        age: age ? Number(age) : undefined,
      };
      if (isCreate) {
        body.username = username;
        body.password = password;
        await api.post('/users', body);
      } else if (user) {
        if (password) body.password = password;
        await api.patch(`/users/${user.id}`, body);
      }
      toast.success(isCreate ? '已创建' : '已更新');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? '新建用户' : '编辑用户'}</DialogTitle>
          <DialogDescription>{isCreate ? '密码会自动 MD5 加盐加密保存' : `${user?.username}`}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="u-username">用户名</Label>
            <Input id="u-username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!isCreate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-pwd">{isCreate ? '初始密码' : '重置密码 (留空不改)'}</Label>
            <Input id="u-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-name">真实姓名</Label>
            <Input id="u-name" value={realName} onChange={(e) => setRealName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-no">工号</Label>
            <Input id="u-no" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>性别</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男</SelectItem>
                <SelectItem value="female">女</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-age">年龄</Label>
            <Input id="u-age" type="number" min="16" max="100" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">普通管理员</SelectItem>
                <SelectItem value="super_admin">超级管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} loading={busy}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
