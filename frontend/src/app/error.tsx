'use client';

/**
 * G3: 全局 ErrorBoundary
 *
 * Next.js App Router 自动加载 src/app/error.tsx 作为根级错误边界.
 * 任何 React 渲染期/数据请求期未捕获的异常都会落在这里, 用户看到的是
 * 设计内的友好错误页, 而不是整页白屏.
 */

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 让错误进控制台, 便于演示前现场排查
    // eslint-disable-next-line no-console
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="size-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="size-8 text-destructive" strokeWidth={1.6} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold">页面出错了</h1>
          <p className="text-sm text-muted-foreground mt-2">
            抱歉, 页面渲染时出现了未预期的错误. 已记录到控制台, 您可以尝试重试.
          </p>
        </div>
        {error.digest && (
          <p className="text-xs font-mono text-muted-foreground/70">
            digest: {error.digest}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>
            <RotateCcw className="size-4" />重试
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
            回到首页
          </Button>
        </div>
      </div>
    </div>
  );
}
