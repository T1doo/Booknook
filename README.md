# 📚 BookNook · 暖书阁 · 图书销售管理系统

> **数据库引论 · 2026 中期实验**
> 一套覆盖图书进货、销售、财务全流程的精美书城管理系统。
> Node.js + Next.js + PostgreSQL 16 全栈实现。
>
> 作者: **李俊辉 24307090032**

---

## ✨ 项目亮点

| 维度 | 内容 |
|-----|------|
| 📊 **数据库** | 10 张表 / 6 个 Dashboard 视图 / 5 个触发器 / 5 个 PL/pgSQL 函数 / 满足 BCNF |
| 🎨 **UI 设计** | 暖书店主题 · 米色+琥珀色 / Playfair Display + Noto Serif SC / 响应式 + 暗色模式 |
| ⚙️ **后端** | Express + TypeScript + Prisma + JWT(HttpOnly) + MD5+salt + RBAC + 操作审计 |
| 🌐 **前端** | Next.js 15 + React 19 + shadcn/ui + Recharts + 中英国际化 |
| 📈 **加分项** | 数据可视化 / 库存预警 / 操作日志 / Excel+PDF 导出 / 暗色模式 / 国际化 / 全栈 TypeScript |

## 🚀 一分钟启动

```powershell
# Step 1 · 初始化数据库
$env:PGPASSWORD = "你的密码"
.\scripts\00-init-db.ps1

# Step 2 · 后端 (新终端)
cd backend && npm install && npm run dev

# Step 3 · 前端 (新终端)
cd frontend && npm install && npm run dev
```

打开 http://localhost:3000 → 演示账号 `super / Admin@2026`

详见 [`操作手册.md`](./操作手册.md)。

## 📂 目录结构

```
booknook/
├── 操作手册.md       ← 现场演示流程 / 助教 FAQ / 答辩准备
├── README.md         ← 你正在看
├── database/         ← PostgreSQL 脚本 (schema / seed / views)
├── backend/          ← Express + Prisma 后端
├── frontend/         ← Next.js + shadcn/ui 前端
├── docs/             ← 实验报告 / 数据库设计 / API 文档 / 创新点
└── scripts/          ← 一键初始化 / 启动脚本
```

## 🖼 截图预览

| | |
|--|--|
| ![登录](./docs/images/01-login.jpeg)        | ![仪表盘](./docs/images/02-dashboard.jpeg)  |
| ![库存](./docs/images/03-books.jpeg)        | ![销售](./docs/images/04-sales.jpeg)        |
| ![进货](./docs/images/05-purchases.jpeg)    | ![财务](./docs/images/06-transactions.jpeg) |

## 📚 关键文档

- [`操作手册.md`](./操作手册.md) — 五分钟启动 · 10 分钟演示流程
- [`docs/实验报告.md`](./docs/实验报告.md) — 提交版完整报告
- [`docs/数据库设计.md`](./docs/数据库设计.md) — ER 图 + 范式分析 + 触发器
- [`docs/API文档.md`](./docs/API文档.md) — 全部 REST 接口
- [`docs/创新点说明.md`](./docs/创新点说明.md) — 加分项专项

## 🛠 技术栈

**后端**
- Node.js 24 · Express · TypeScript · Prisma ORM
- PostgreSQL 16 · pg_trgm · pgcrypto
- JWT · Zod · Pino · ExcelJS · PDFKit

**前端**
- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS · shadcn/ui · Radix Primitives · Lucide Icons
- Recharts · zustand · next-themes · Sonner

## 📜 许可

仅供数据库引论实验提交使用,代码风格鼓励 fork 学习。

---

🌿 **Made with care for 数据库引论 2026.**
