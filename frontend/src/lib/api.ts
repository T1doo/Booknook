/**
 * 后端 API 客户端
 *  - 鉴权全靠 HttpOnly cookie (浏览器自动随同 credentials:include 携带), 不再用 localStorage
 *    存 token, 避免 XSS 偷走凭证 (C6).
 *  - 统一错误处理
 *  - SWR-friendly 的 GET 包装
 */

const isClient = typeof window !== 'undefined';

/**
 * 留作兼容空壳: 旧代码可能仍 import setToken/getToken. 现在它们是 no-op,
 * 因为 token 完全由后端通过 HttpOnly cookie 管理.
 */
export function getToken(): string | null {
  return null;
}

export function setToken(_token: string | null) {
  /* no-op: token 不再存在前端可访问的位置 */
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const DEFAULT_TIMEOUT_MS = 30_000;

type ApiInit = RequestInit & { timeoutMs?: number };

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  init?: ApiInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  // 鉴权统一走 HttpOnly cookie (credentials: 'include'), 不再手动设 Authorization (C6)

  // 用 AbortController 给 fetch 加超时, 否则离线/慢网时 UI 永远停在 loading
  const ctrl = new AbortController();
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body == null ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
      ...init,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(0, -1, '请求超时, 请检查网络或稍后重试');
    }
    throw e;
  }
  clearTimeout(timer);

  if (res.status === 204) return undefined as T;

  let payload: { code: number; data: T; message: string };
  try {
    payload = await res.json();
  } catch {
    throw new ApiError(res.status, res.status, '响应解析失败');
  }

  if (!res.ok || (payload.code != null && payload.code !== 0)) {
    if (res.status === 401 && isClient) {
      // 仅当不在登录页时才重定向 (HttpOnly cookie 已由后端 401 + clearCookie 清除)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    throw new ApiError(res.status, payload.code ?? res.status, payload.message ?? '请求失败');
  }
  return payload.data;
}

export const api = {
  get:    <T>(path: string, init?: RequestInit) => request<T>('GET', path, undefined, init),
  post:   <T>(path: string, body?: unknown)     => request<T>('POST', path, body),
  patch:  <T>(path: string, body?: unknown)     => request<T>('PATCH', path, body),
  put:    <T>(path: string, body?: unknown)     => request<T>('PUT', path, body),
  delete: <T>(path: string)                     => request<T>('DELETE', path),
};

/** 直接下载二进制 (Excel/PDF), 60s 超时 (导出大文件可能慢) */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include', // 用 HttpOnly cookie 鉴权
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('下载超时');
    }
    throw e;
  }
  clearTimeout(timer);
  if (!res.ok) {
    // D5: 把后端 {code, message} 透传, 失败时让用户看到具体原因
    const j = await res.json().catch(() => null);
    throw new Error(j?.message ?? `下载失败 (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
