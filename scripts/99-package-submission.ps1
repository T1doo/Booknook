# BookNook · 打包提交压缩包
#
# 生成 中期实验_24307090032_李俊辉.zip,放到 MidtermLab/ 目录下
# 自动排除 node_modules / .next / dist / .git 等大型目录

param(
    [string]$StudentId = '24307090032',
    [string]$StudentName = '李俊辉'
)

$ErrorActionPreference = 'Stop'

# 切控制台到 UTF-8, 否则中文 Windows 下中文输出乱码
try { chcp 65001 | Out-Null } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root        = Split-Path -Parent $PSScriptRoot
$projectName = '中期实验_' + $StudentId + '_' + $StudentName
$parent      = Split-Path -Parent $root
$tempDir     = Join-Path $env:TEMP $projectName
$zipPath     = Join-Path $parent ($projectName + '.zip')

Write-Host ('=' * 70) -ForegroundColor DarkYellow
Write-Host '   BookNook · 打包提交' -ForegroundColor Yellow
Write-Host ('=' * 70) -ForegroundColor DarkYellow

# F11: 打包前完整性断言, 防止"压完才发现少了关键文件"的演示前事故.
$required = @(
    'database/01-schema.sql',
    'database/02-seed.sql',
    'database/03-views.sql',
    'database/99-drop-all.sql',
    'backend/prisma/schema.prisma',
    'backend/.env.example',
    'README.md',
    'docs/实验报告.md',
    'docs/数据库设计.md',
    'docs/API文档.md',
    'docs/创新点说明.md'
)
Write-Host '[0] 校验关键文件 ...' -ForegroundColor Cyan
$missing = @()
foreach ($f in $required) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) { $missing += $f }
}
if ($missing.Count -gt 0) {
    Write-Host '[ERROR] 缺少以下关键文件, 终止打包:' -ForegroundColor Red
    $missing | ForEach-Object { Write-Host ('  - ' + $_) -ForegroundColor Red }
    exit 1
}
Write-Host ('       全部 {0} 个关键文件已就位' -f $required.Count) -ForegroundColor DarkGreen

# 1. 清理旧文件
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host '[1] 复制源代码 (排除依赖/构建产物) ...' -ForegroundColor Cyan

# 排除大目录
$excludeDirs = @('node_modules', '.next', 'dist', '.git', '.turbo', '.cache', 'coverage', '.idea', '.vscode')
$excludeFiles = @('*.log', '*.tmp', '.DS_Store', 'Thumbs.db')

# 用 robocopy 高效复制
$rcArgs = @($root, $tempDir, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP') +
          @('/XD') + $excludeDirs +
          @('/XF') + $excludeFiles
robocopy @rcArgs | Out-Null

# robocopy exit codes 0-7 都是成功 (8+ 才是失败)
if ($LASTEXITCODE -ge 8) {
    Write-Host '[ERROR] robocopy 失败' -ForegroundColor Red
    exit 1
}

# 2. 统计
$fileCount = (Get-ChildItem $tempDir -Recurse -File).Count
$totalSize = (Get-ChildItem $tempDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
$mbSize    = [Math]::Round($totalSize / 1MB, 2)
Write-Host ('[2] 共 {0} 个文件, 总大小 {1} MB' -f $fileCount, $mbSize) -ForegroundColor Cyan

# 3. 压缩
Write-Host '[3] 压缩为 zip ...' -ForegroundColor Cyan
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force

# 4. 清理临时
Remove-Item $tempDir -Recurse -Force

# 5. 完成
$zipInfo = Get-Item $zipPath
$zipMb   = [Math]::Round($zipInfo.Length / 1MB, 2)
Write-Host ('-' * 70) -ForegroundColor DarkYellow
Write-Host '[DONE] 提交包已生成:' -ForegroundColor Green
Write-Host "       $zipPath" -ForegroundColor White
Write-Host ('       大小: {0} MB' -f $zipMb) -ForegroundColor White
Write-Host ('-' * 70) -ForegroundColor DarkYellow
