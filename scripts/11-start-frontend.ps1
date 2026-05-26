<#
.SYNOPSIS
    BookNook · 启动前端开发服务
.DESCRIPTION
    首次运行会自动 npm install,之后直接 npm run dev
#>
$ErrorActionPreference = 'Stop'

# 切控制台到 UTF-8, 否则中文 Windows 下中文输出乱码
try {
    chcp 65001 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[WARN] chcp 65001 failed, Chinese text may display incorrectly' -ForegroundColor Yellow
    }
} catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$fe   = Join-Path $root 'frontend'
Set-Location $fe

if (-not (Test-Path 'node_modules')) {
    Write-Host '[INSTALL] 首次启动,正在安装依赖 (约 2 min) ...' -ForegroundColor Yellow
    npm install --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERROR] npm install 失败, 请检查网络或 npm 配置' -ForegroundColor Red
        exit 1
    }
}

Write-Host '[START] 启动 Next.js 开发服务 http://localhost:3000 ...' -ForegroundColor Green
npm run dev
