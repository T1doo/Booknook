<#
.SYNOPSIS
    BookNook · 启动前端开发服务
.DESCRIPTION
    首次运行会自动 npm install,之后直接 npm run dev
#>
$ErrorActionPreference = 'Stop'

# 切控制台到 UTF-8, 否则中文 Windows 下中文输出乱码
try { chcp 65001 | Out-Null } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$fe   = Join-Path $root 'frontend'
Set-Location $fe

if (-not (Test-Path 'node_modules')) {
    Write-Host '[INSTALL] 首次启动,正在安装依赖 (约 2 min) ...' -ForegroundColor Yellow
    npm install --no-audit --no-fund --loglevel=error
}

Write-Host '[START] 启动 Next.js 开发服务 http://localhost:3000 ...' -ForegroundColor Green
npm run dev
