<#
.SYNOPSIS
    BookNook · 重置数据库 (drop + re-create + seed)
#>
[CmdletBinding()]
param(
    [string]$PgHost = '127.0.0.1',
    [int]   $PgPort = 5432,
    [string]$PgUser = 'postgres',
    [string]$DbName = 'booknook'
)

& "$PSScriptRoot\00-init-db.ps1" -PgHost $PgHost -PgPort $PgPort -PgUser $PgUser -DbName $DbName
exit $LASTEXITCODE
