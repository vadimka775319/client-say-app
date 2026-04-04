# Синхронизация схемы Prisma с БД и прогон сида (Windows / PowerShell).
# Запуск из корня проекта:  .\scripts\db-sync.ps1
# Или:  npm run db:sync

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ""
Write-Host "=== ClientSay: prisma db push + db seed ===" -ForegroundColor Cyan
Write-Host "Каталог: $root"
Write-Host "DATABASE_URL берётся из .env в этом каталоге (часто localhost)." -ForegroundColor DarkGray
Write-Host ""

npx prisma db push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx prisma db seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Готово: схема применена, сид выполнен." -ForegroundColor Green
Write-Host "На проде то же самое делает GitHub Actions при push в main (если деплой настроен)." -ForegroundColor DarkGray
Write-Host ""
