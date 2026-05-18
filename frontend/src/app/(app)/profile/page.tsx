'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserCircle2, KeyRound } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [realName, setRealName] = useState('');
  const [gender, setGender]     = useState<'male' | 'female' | 'other'>('other');
  const [age, setAge]           = useState('');
  const [busy, setBusy] = useState(false);

  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdAgain, setPwdAgain] = useState('');
  const [busy2, setBusy2] = useState(false);

  useEffect(() => {
    if (me) {
      setRealName(me.real_name);
      setGender(me.gender);
      setAge(me.age?.toString() ?? '');
    }
  }, [me]);

  if (!me) return null;

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api.patch('/auth/me', {
        real_name: realName, gender, age: age ? Number(age) : undefined,
      });
      setUser({ ...me, real_name: realName, gender, age: age ? Number(age) : null });
      toast.success('已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally { setBusy(false); }
  };

  const changePwd = async () => {
    if (!pwdOld) { toast.error('请输入原密码'); return; }
    if (pwdNew.length < 6) { toast.error('新密码至少 6 位'); return; }
    if (pwdNew !== pwdAgain) { toast.error('两次输入不一致'); return; }
    setBusy2(true);
    try {
      await api.patch('/auth/me', { password: pwdNew, current_password: pwdOld });
      toast.success('密码已修改,下次登录请使用新密码');
      setPwdOld(''); setPwdNew(''); setPwdAgain('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally { setBusy2(false); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="我的信息" description="可修改个人资料 / 重置密码" />

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle2 className="size-5 text-primary" />基本资料
            </CardTitle>
            <CardDescription>用户名 / 工号 / 角色由超级管理员管理</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>用户名</Label>
              <Input value={me.username} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>工号</Label>
              <Input value={me.employee_no} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <div className="h-10 flex items-center">
                <Badge variant={me.role === 'super_admin' ? 'default' : 'muted'}>
                  {me.role === 'super_admin' ? '超级管理员' : '普通管理员'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">真实姓名</Label>
              <Input id="p-name" value={realName} onChange={(e) => setRealName(e.target.value)} />
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
              <Label htmlFor="p-age">年龄</Label>
              <Input id="p-age" type="number" min="16" max="100"
                     value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={saveProfile} loading={busy} className="ml-auto">保存资料</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />修改密码
            </CardTitle>
            <CardDescription>密码以 MD5 + salt 加密保存</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="pwd-old">原密码</Label>
              <Input id="pwd-old" type="password" autoComplete="current-password"
                     value={pwdOld} onChange={(e) => setPwdOld(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-new">新密码</Label>
              <Input id="pwd-new" type="password" autoComplete="new-password"
                     value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-again">确认新密码</Label>
              <Input id="pwd-again" type="password" autoComplete="new-password"
                     value={pwdAgain} onChange={(e) => setPwdAgain(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={changePwd} loading={busy2} className="ml-auto">修改密码</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
