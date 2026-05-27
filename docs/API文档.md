---
create time: 2026-05-17T13:00:00
tags:
  - homework
  - 数据库引论
  - API
---

# BookNook · REST API 文档

> 基础地址 `http://localhost:4000/api`
>
> **鉴权 (v1.1 起)**: 全程通过 **HttpOnly Cookie `booknook_token`** (SameSite=strict, path=/api). 客户端只需 `credentials: 'include'` 即可, **不需要也无法**手动设置 Authorization (响应 body 不再含 token, 这是 v1.1 移除的 XSS 防御).
>
> 响应统一格式 `{ code: 0 | <number>, data: T | null, message: string }`

---

## 一、认证 `/auth`

### `POST /auth/login`

> 限速 20 次/15min/IP, 超过返回 `429` (code=4029).

**Body**:
```json
{ "username": "super", "password": "Admin@2026" }
```

**200**:
```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "1",
      "username": "super",
      "real_name": "李俊辉",
      "employee_no": "EMP-0001",
      "role": "super_admin",
      "gender": "male",
      "age": 22
    }
  },
  "message": "OK"
}
```

服务端通过 `Set-Cookie: booknook_token=<JWT>; HttpOnly; SameSite=Strict; Path=/api` 下发会话凭据.

> 注意: v1.1 起响应 body **不再含 `token` 字段** (XSS 防御). 客户端只需保留浏览器 cookie 即可, 后续请求带 `credentials: 'include'` 让浏览器自动携带.

### `POST /auth/logout`
清除 Cookie,返回 `{ code:0, data:null, message:'已登出' }`。

### `GET /auth/me`
返回当前登录用户完整信息 (不含密码字段)。

### `PATCH /auth/me`
**Body**: `{ real_name?, gender?, age?, password? }`

---

## 二、用户管理 `/users` (仅超管)

### `GET /users?q=&role=&page=&pageSize=`

返回 `{ total, page, pageSize, list: User[] }`。

### `POST /users`

**Body**:
```json
{
  "username": "admin3",
  "password": "init123",
  "real_name": "陈秋秋",
  "employee_no": "EMP-1003",
  "gender": "female",
  "age": 30,
  "role": "admin"
}
```

冲突 (用户名/工号重复) 返回 409。

### `PATCH /users/:id`
**Body** (任意子集): `{ real_name?, employee_no?, gender?, age?, role?, is_active?, password? }`

### `DELETE /users/:id`
软删除 (置 `is_active=false`),不能删自己。

---

## 三、库存图书 `/books`

### `GET /books?q=&field=all|id|isbn|title|author|publisher&category=&page=&pageSize=&sort=&order=&lowStock=`

**示例**:
- `?q=红楼&field=title` — 书名包含"红楼"
- `?q=9787020002207&field=isbn` — 精确 ISBN
- `?lowStock=true` — 仅看库存告急
- `?sort=stock&order=asc` — 按库存升序

**响应**:
```json
{
  "code": 0,
  "data": {
    "total": 30,
    "page": 1,
    "pageSize": 20,
    "list": [{ "id": "1", "isbn": "9787020002207", "title": "红楼梦", "stock": 48, ... }]
  }
}
```

### `GET /books/categories`
返回各分类汇总: `[{ category, count, stock }]`

### `GET /books/:id`
单本详情。

### `PATCH /books/:id`
**Body** (任意子集):
```json
{
  "title": "新书名",
  "author": "新作者",
  "publisher": "新出版社",
  "retail_price": 49.00,
  "low_stock_threshold": 5,
  "category": "经典文学"
}
```

### `POST /books`
直接新增已知库存书 (一般通过进货入库,这是补录用)。

### `DELETE /books/:id`
仅允许删库存为 0 且无销售历史的书。

---

## 四、进货 `/purchases`

### `GET /purchases?status=&q=&page=&pageSize=`

`status` ∈ `pending` / `paid` / `returned` / `received` / 空(全部)
`q` 模糊 `order_no` / `supplier`

### `GET /purchases/:id`
详情,包含 `items: [{...}]` 与 `user: {...}`。

### `POST /purchases`
**Body**:
```json
{
  "supplier": "中信出版社",
  "remark": "5月补货",
  "items": [
    {
      "book_id": 3,                   /* 已有书直接引用 */
      "isbn": "9787508692586",
      "title": "人类简史",
      "publisher": "中信出版社",
      "author": "尤瓦尔·赫拉利",
      "purchase_price": 35.00,
      "quantity": 20
    },
    {
      /* 新书首次进货, book_id 不填 */
      "isbn": "9787999000123",
      "title": "新书示例",
      "publisher": "测试社",
      "author": "测试",
      "purchase_price": 25.00,
      "quantity": 10
    }
  ]
}
```

返回新建的进货单,状态为 `pending`。

### `POST /purchases/:id/pay`
状态 `pending → paid`,触发器同时写一条 `expense` 流水。
非 pending 状态请求会返回 400。

### `POST /purchases/:id/return`
状态 `pending → returned`。
非 pending 状态请求会返回 400。

### `POST /purchases/:id/receive`
状态 `paid → received`,触发器入库 (新书 INSERT;已有 +stock)。

**Body** (`retail_prices` 字段可选):
```json
{
  "retail_prices": [
    { "item_id": 5, "retail_price": 45.00 }
  ]
}
```

**触发器对 `retail_price` 的处理** (`COALESCE` 语义):

| 明细类型 | `retail_prices` 含本明细? | books.retail_price 最终值 |
|---|---|---|
| 新书 (book_id IS NULL) | 是 | 操作员指定的值 |
| 新书 (book_id IS NULL) | 否 | `purchase_price * 1.5` (fallback) |
| 老书 (book_id 已知) | 是 | 操作员指定的值 (覆盖原值) |
| 老书 (book_id 已知) | 否 | 保留 books 表原值 (不变) |

前端 UI 约定: 新书必须传 retail_price (调用前对话框强制填写), 老书默认不传 (沿用现价)。

---

## 五、销售 `/sales`

### `GET /sales?q=&from=&to=&page=&pageSize=`

`q` 模糊 `order_no`,`from`/`to` ISO 时间。

### `GET /sales/:id`
含 `items: [{ book: {...} }]`。

### `POST /sales` (一次性结账)

**Body**:
```json
{
  "customer_note": "老顾客",
  "items": [
    { "book_id": 1, "quantity": 2 },
    { "book_id": 5, "quantity": 1 }
  ]
}
```

后端预检每本书库存,任一不足直接返回 400 (附详细信息),整个事务回滚。
成功后:
- 创建销售单 (触发器写 income 流水)
- 插入明细 (触发器扣库存 + 库存预警检查)

---

## 六、财务 `/transactions`

### `GET /transactions?type=&from=&to=&page=&pageSize=`

`type` ∈ `income` / `expense` / 空。

**响应**:
```json
{
  "code": 0,
  "data": {
    "total": 35,
    "list": [{ "type": "income", "amount": 256.40, "description": "...", "created_at": "..." }],
    "summary": {
      "income": 12450.00,
      "expense": 8200.00,
      "income_count": 18,
      "expense_count": 7
    }
  }
}
```

---

## 七、报表导出 `/reports`

| 端点 | 返回 |
|------|------|
| `GET /reports/sales.xlsx?from=&to=`     | XLSX 销售明细 (中文表头加粗高亮) |
| `GET /reports/purchases.xlsx?status=`   | XLSX 进货明细 |
| `GET /reports/finance.xlsx?from=&to=`   | XLSX 财务流水 (含合计行) |
| `GET /reports/finance.pdf?from=&to=`    | PDF 财务报表 |

响应头:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="sales-2026-05-17.xlsx"
```

---

## 八、数据分析 `/analytics`

### `GET /analytics/dashboard`
```json
{
  "today":           { "sales": 0,     "orders": 0 },
  "month":           { "sales": 453.4, "orders": 2 },
  "stock":           { "totalStock": 656, "titles": 30 },
  "pendingPurchase": { "amount": 0, "count": 0 },
  "alertsCount":     0
}
```

### `GET /analytics/sales-trend`
近 30 天每日销售:
```json
[
  { "day": "2026-05-15", "order_count": 0, "book_count": 0, "total_amount": 0 },
  { "day": "2026-05-16", "order_count": 1, "book_count": 2, "total_amount": 394 }
]
```

### `GET /analytics/top-books`
Top10 畅销书:
```json
[
  { "book_id": "1", "title": "红楼梦", "sold_qty": 2, "sold_amount": 119.4 }
]
```

### `GET /analytics/finance-monthly`
```json
[{ "month": "2026-05", "income": 453.4, "expense": 816, "net": -362.6, "count": 3 }]
```

### `GET /analytics/category`
```json
[{ "category": "文学", "titles": 9, "stock": 287 }]
```

---

## 九、库存预警 `/alerts`

### `GET /alerts`
所有未解决的预警 (含 `book` 嵌套对象)。

### `POST /alerts/:id/resolve`
手动标记某条预警为已处理。

### `PATCH /alerts/threshold/:bookId`
**Body**: `{ "low_stock_threshold": 3 }`

修改某书的阈值并重新评估预警。

---

## 十、操作日志 `/logs` (仅超管)

### `GET /logs?user_id=&action=&resource=&from=&to=&page=&pageSize=`

**示例**:
- `?action=delete` — 所有删除操作
- `?resource=users` — 所有针对用户表的操作
- `?user_id=1&from=2026-05-01T00:00:00Z` — 某人最近的操作

**响应**:
```json
{
  "total": 12,
  "list": [
    {
      "id": "12",
      "user": { "username": "super", "real_name": "李俊辉" },
      "action": "create",
      "resource": "purchases",
      "resource_id": "5",
      "ip": "::1",
      "payload": { "supplier": "X", "items": [...] },
      "created_at": "2026-05-17T..."
    }
  ]
}
```

---

## 十一、错误码

| HTTP | code | 说明 |
|------|------|------|
| 400 | 4000 | 请求参数错误 / 业务规则不通过 / `BigInt('abc')` 类语法错 |
| 401 | 4001 | 未登录 / Token 过期 / 账号已被停用 (is_active=false 实时校验) |
| 403 | 4003 | 权限不足 (非超管访问超管接口) |
| 404 | 4004 | 资源不存在 (含 Prisma `P2025`) |
| 409 | 4009 | 冲突 (例: 用户名已存在; Prisma `P2002` 唯一约束) |
| 422 | 4220 | Zod 校验失败 |
| 429 | 4029 | 速率限制触发 (登录 20 次/15min) |
| 500 | 5000 | 服务器内部错误 (生产环境只返回此通用文案, 开发环境保留原 message) |

错误响应统一:
```json
{ "code": 4001, "data": null, "message": "请先登录" }
```

> v1.1 增强: Prisma 已知错误码 (P2002 / P2003 / P2025) 会被映射到合适的 HTTP 状态; `SyntaxError` (如 BigInt('abc')) 映射到 400; 生产环境兜底 message 脱敏.

---

## 十二、cURL 速查

v1.1 起 token 只通过 HttpOnly Cookie 下发, 用 `-c cookies.txt` 保存 + `-b cookies.txt` 携带:

```bash
# 1. 登录, cookie 写到 cookies.txt
curl -s -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"super","password":"Admin@2026"}'

# 2. 携带 cookie 查询红楼梦
curl -b cookies.txt 'http://localhost:4000/api/books?q=红楼&field=title'

# 3. 看 Dashboard
curl -b cookies.txt 'http://localhost:4000/api/analytics/dashboard'

# 4. 导出销售 Excel
curl -b cookies.txt -O -J 'http://localhost:4000/api/reports/sales.xlsx'

# 5. 登出 (清除 cookie)
curl -b cookies.txt -c cookies.txt -X POST 'http://localhost:4000/api/auth/logout'
```

如果你的工具链需要程序化拿 token, 推荐用 Python `http.cookiejar.CookieJar` 维护会话 (参考 `scripts/smoke-test.py`).
