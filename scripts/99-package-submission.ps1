# BookNook · 打包提交压缩包
#
# 生成 中期实验_24307090032_李俊辉.zip,放到 MidtermLab/ 目录下
# 自动排除 node_modules / .next / dist / .git 等大型目录

param(
    [string]$StudentId = '24307090032',
    [string]$StudentName = '李俊辉'
)

$ErrorActionPreference = 'Stop'

$root        = Split-Path -Parent $PSScriptRoot
$projectName = '中期实验_' + $StudentId + '_' + $StudentName
$parent      = Split-Path -Parent $root
$tempDir     = Join-Path $env:TEMP $projectName
$zipPath     = Join-Path $parent ($projectName + '.zip')

Write-Host ('=' * 70) -ForegroundColor DarkYellow
Write-Host '   BookNook · 打包提交' -ForegroundColor Yellow
Write-Host ('=' * 70) -ForegroundColor DarkYellow

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
