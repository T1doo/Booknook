<#
.SYNOPSIS
    BookNook · 重置为"PPT 最小合规态" (3 个账号已就位, 业务数据与书籍全空)
.DESCRIPTION
    符合 PPT "系统完成时便已经存在超管账号" 的要求, 但库存/订单/流水/日志全部为空.

    适合场景:
    - 想从零演示"建书 → 进货 → 入库 → 销售"完整业务流程
    - 给老师看一遍"系统刚部署上线"的状态
    - 跟默认的 01-reset-db (含 30 本书 + 演示订单) 形成对照

    跟 00-init-db / 01-reset-db 的区别:
    | 脚本                     | users | books | 进货销售 | 流水 |
    |--------------------------|-------|-------|----------|------|
    | 00-init-db / 01-reset-db | 3     | 30    | 1+2      | 3    |
    | 02-reset-empty           | 3     | 0     | 0        | 0    |

    实现: 先调 00-init-db.ps1 完整初始化, 再 TRUNCATE 清空 books + 业务表.
.EXAMPLE
    $env:PGPASSWORD = "你的密码"
    .\scripts\02-reset-empty.ps1
#>
[CmdletBinding()]
param(
    [string]$PgHost = '127.0.0.1',
    [int]   $PgPort = 5432,
    [string]$PgUser = 'postgres',
    [string]$DbName = 'booknook'
)

$ErrorActionPreference = 'Stop'

try {
    chcp 65001 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[WARN] chcp 65001 failed, Chinese text may display incorrectly' -ForegroundColor Yellow
    }
} catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PGCLIENTENCODING = 'UTF8'

function Write-Section($t) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor DarkYellow
    Write-Host "  $t" -ForegroundColor Yellow
    Write-Host ("=" * 70) -ForegroundColor DarkYellow
}

# ----- Step 1: 完整初始化 (复用 00-init-db.ps1, 不重复代码) -----
Write-Section "Step 1/2 · 完整初始化 (含 seed)"

& "$PSScriptRoot\00-init-db.ps1" -PgHost $PgHost -PgPort $PgPort -PgUser $PgUser -DbName $DbName
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 完整初始化失败, 中止" -ForegroundColor Red
    exit 1
}

# ----- Step 2: TRUNCATE 业务表 + books -----
Write-Section "Step 2/2 · 清空业务数据与书籍 (保留 users + i18n_dict)"

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    Write-Host "[ERROR] psql 不可用" -ForegroundColor Red
    exit 1
}

$dbArgs = @('-h', $PgHost, '-p', "$PgPort", '-U', $PgUser, '-d', $DbName,
            '-v', 'ON_ERROR_STOP=1', '-q')

# 清空顺序: 业务表 + books, CASCADE 处理外键, RESTART IDENTITY 让 ID 从 1 重新开始
# users 和 i18n_dict 不动 (前者 PPT 要求, 后者前端中英切换需要)
& $psql @dbArgs -c "TRUNCATE TABLE sale_order_items, sale_orders, purchase_order_items, purchase_orders, transactions, operation_logs, inventory_alerts, books RESTART IDENTITY CASCADE;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] TRUNCATE 失败" -ForegroundColor Red
    exit 1
}

# ----- 自检 -----
Write-Section "自检"
& $psql @dbArgs -c "SELECT username, role, real_name FROM users ORDER BY id;"
& $psql @dbArgs -c @"
SELECT 'books'           AS table_name, COUNT(*)::TEXT AS row_count FROM books
UNION ALL SELECT 'purchase_orders', COUNT(*)::TEXT FROM purchase_orders
UNION ALL SELECT 'sale_orders',     COUNT(*)::TEXT FROM sale_orders
UNION ALL SELECT 'transactions',    COUNT(*)::TEXT FROM transactions
UNION ALL SELECT 'operation_logs',  COUNT(*)::TEXT FROM operation_logs
UNION ALL SELECT 'inventory_alerts',COUNT(*)::TEXT FROM inventory_alerts
UNION ALL SELECT 'i18n_dict',       COUNT(*)::TEXT FROM i18n_dict
ORDER BY table_name;
"@

Write-Host ""
Write-Host "[DONE] BookNook 已重置为最小合规态!" -ForegroundColor Green
Write-Host "  - 用户: super / admin1 / admin2 (密码 Admin@2026)" -ForegroundColor Cyan
Write-Host "  - 库存: 空 (需先建进货单 → 入库后才能销售)" -ForegroundColor Cyan
Write-Host "  - 流水/日志/预警: 空" -ForegroundColor Cyan
Write-Host "  - i18n 词条: 保留 (前端中英切换需要)" -ForegroundColor Cyan
