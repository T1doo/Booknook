# BookNook · 数据库脚本

> 用于"图书销售管理系统"(中期实验)的全部 PostgreSQL 脚本。

## 文件清单

| 文件 | 用途 | 顺序 |
|------|------|------|
| `01-schema.sql` | 创建枚举 / 10 张表 / 索引 / 触发器 / 函数 | ① 必跑 |
| `02-seed.sql`   | 写入 3 个用户 + 30 本图书 + 演示订单 | ② 必跑 |
| `03-views.sql`  | 创建 6 个报表 / Dashboard 视图 | ③ 必跑 |
| `99-drop-all.sql` | 销毁全部对象 (重置环境用) | 仅在需要重置时 |

## 一键初始化

在项目根目录运行:

```powershell
.\scripts\00-init-db.ps1
```

该脚本会:
1. 检查 `psql` 可用性
2. 创建/重建 `booknook` 数据库
3. 按顺序执行 `01 → 02 → 03`
4. 打印每张表的行数确认初始化成功

## ER 图

```
                   ┌──────────────┐
                   │    users     │
                   └──────┬───────┘
                          │ 1
              ┌───────────┼───────────┐
              │ N         │ N         │ N
              ▼           ▼           ▼
   ┌──────────────────┐ ┌─────────────┐ ┌────────────────┐
   │ purchase_orders  │ │ sale_orders │ │  transactions  │
   └────┬─────────────┘ └─────┬───────┘ └────────────────┘
        │ 1                   │ 1
        │ N                   │ N
        ▼                     ▼
   ┌──────────────────────┐ ┌──────────────────────┐
   │ purchase_order_items │ │  sale_order_items    │
   └─────────┬────────────┘ └─────────┬────────────┘
             │ N                      │ N
             ▼                        ▼
         ┌─────────────────────────────────┐
         │            books                │ ← inventory_alerts
         └─────────────────────────────────┘
```

## 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `super`  | `Admin@2026` | 超级管理员 (super_admin) |
| `admin1` | `Admin@2026` | 普通管理员 (admin) |
| `admin2` | `Admin@2026` | 普通管理员 (admin) |

## 设计要点 (BCNF 校验)

- **`books`**: 主键 `id`、唯一 `isbn`、其余非键属性都直接依赖主键。
- **`purchase_order_items`**: `subtotal` 是 STORED GENERATED 列,
  避免与 `purchase_price * quantity` 数据冗余。
- **`transactions`**: `amount` 与 `purchase_orders.total_amount` 看似冗余,
  但属于"事实表"模式(订单可改 / 流水不可改),用于审计追溯。

## 触发器一览

| 触发器 | 触发时机 | 作用 |
|--------|----------|------|
| `trg_users_updated_at`         | UPDATE users         | 自动更新 `updated_at` |
| `trg_books_updated_at`         | UPDATE books         | 同上 |
| `trg_po_updated_at`            | UPDATE purchase_orders | 同上 |
| `trg_sale_items_after_insert`  | INSERT sale_order_items | 扣库存 + 库存预警检查 |
| `trg_sale_orders_after_insert` | INSERT sale_orders     | 写入 income 流水 |
| `trg_purchase_status_change`   | UPDATE purchase_orders.status | 付款写支出流水 / 入库更新 books |
