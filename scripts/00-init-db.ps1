<#
.SYNOPSIS
    BookNook · 数据库一键初始化
.DESCRIPTION
    1. 检查 psql 可用
    2. 创建/重建数据库 booknook
    3. 顺序执行 01-schema.sql / 02-seed.sql / 03-views.sql
.PARAMETER PgHost      默认 127.0.0.1
.PARAMETER PgPort      默认 5432
.PARAMETER PgUser      默认 postgres
.PARAMETER DbName      默认 booknook
.EXAMPLE
    .\scripts\00-init-db.ps1
    .\scripts\00-init-db.ps1 -PgUser postgres -PgPort 5432
#>
[CmdletBinding()]
param(
    [string]$PgHost = '127.0.0.1',
    [int]   $PgPort = 5432,
    [string]$PgUser = 'postgres',
    [string]$DbName = 'booknook'
)

$ErrorActionPreference = 'Stop'

# 把控制台 + .NET 输出统一切到 UTF-8, 否则中文 Windows (gb2312) 下显示 psql 中文输出会乱码
try {
    chcp 65001 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[WARN] chcp 65001 failed, Chinese text may display incorrectly' -ForegroundColor Yellow
    }
} catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 关键: 告诉 psql "我发给你的 SQL 是 UTF-8". 否则中文 Windows 上 psql 的
# client_encoding 默认跟随系统区域(GBK), 会把 UTF-8 文件里的中文字节当成 GBK
# 解码失败, 报 "编码 GBK 的字符 0x.. 在编码 UTF8 没有相对应值".
$env:PGCLIENTENCODING = 'UTF8'

function Write-Section($t) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor DarkYellow
    Write-Host "  $t"  -ForegroundColor Yellow
    Write-Host ("=" * 70) -ForegroundColor DarkYellow
}

# ----- 工具检测 -----------------------------------------------------------
Write-Section "0. 环境检测"
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    Write-Host "[ERROR] 未找到 psql, 请安装 PostgreSQL 16 客户端" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] psql = $psql"

# 提示输入密码 (若未设置 PGPASSWORD 环境变量)
if (-not $env:PGPASSWORD) {
    $sec = Read-Host "请输入用户 $PgUser 的数据库密码" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

# 解析路径
$root        = Split-Path -Parent $PSScriptRoot
$dbDir       = Join-Path $root 'database'
$schemaFile  = Join-Path $dbDir '01-schema.sql'
$seedFile    = Join-Path $dbDir '02-seed.sql'
$viewsFile   = Join-Path $dbDir '03-views.sql'
$dropFile    = Join-Path $dbDir '99-drop-all.sql'

foreach ($f in @($schemaFile, $seedFile, $viewsFile)) {
    if (-not (Test-Path $f)) {
        Write-Host "[ERROR] 缺少脚本: $f" -ForegroundColor Red
        exit 1
    }
}

# ----- 创建/重建数据库 ----------------------------------------------------
Write-Section "1. 重建数据库 $DbName"

$baseArgs = @('-h', $PgHost, '-p', "$PgPort", '-U', $PgUser, '-d', 'postgres',
              '-v', 'ON_ERROR_STOP=1', '-q')

& $psql @baseArgs -c "DROP DATABASE IF EXISTS $DbName;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] DROP DATABASE 失败, 请检查密码与连接" -ForegroundColor Red
    exit 1
}
& $psql @baseArgs -c "CREATE DATABASE $DbName ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] CREATE DATABASE 失败" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] 数据库 $DbName 已重建"

# ----- 执行三段脚本 -------------------------------------------------------
$dbArgs = @('-h', $PgHost, '-p', "$PgPort", '-U', $PgUser, '-d', $DbName,
            '-v', 'ON_ERROR_STOP=1')

Write-Section "2. 执行 01-schema.sql"
& $psql @dbArgs -f $schemaFile
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] schema 失败" -ForegroundColor Red; exit 1 }

Write-Section "3. 执行 02-seed.sql"
& $psql @dbArgs -f $seedFile
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] seed 失败" -ForegroundColor Red; exit 1 }

Write-Section "4. 执行 03-views.sql"
& $psql @dbArgs -f $viewsFile
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] views 失败" -ForegroundColor Red; exit 1 }

# ----- 自检 ---------------------------------------------------------------
Write-Section "5. 自检"
& $psql @dbArgs -c "\dt"
& $psql @dbArgs -c "\dv"
& $psql @dbArgs -c "SELECT username, role FROM users ORDER BY id;"
& $psql @dbArgs -c "SELECT COUNT(*) AS books FROM books;"

Write-Host ""
Write-Host "[DONE] BookNook 数据库初始化完毕!" -ForegroundColor Green
Write-Host "默认账号: super / admin1 / admin2,  密码: Admin@2026" -ForegroundColor Cyan
