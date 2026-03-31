#Requires -Version 5.1
<#
.SYNOPSIS
  Инициализация git (один раз), коммит и опционально push на GitHub.

.USAGE
  Первый раз (только локальный коммит):
    powershell -ExecutionPolicy Bypass -File .\scripts\sync-github.ps1 -FirstCommit

  С привязкой к GitHub и push:
    powershell -ExecutionPolicy Bypass -File .\scripts\sync-github.ps1 -RemoteUrl "https://github.com/USER/REPO.git" -Push

  Обычное сохранение и отправка:
    powershell -ExecutionPolicy Bypass -File .\scripts\sync-github.ps1 -Message "описание изменений" -Push
#>
param(
    [string]$Message = "Update ClientSay",
    [string]$RemoteUrl = "",
    [switch]$FirstCommit,
    [switch]$Push
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git не найден. Установите Git for Windows: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
    Write-Host "[1/5] git init" -ForegroundColor Cyan
    git init
    git branch -M main
}

Write-Host "[2/5] git add ." -ForegroundColor Cyan
git add .

$status = git status --porcelain
if (-not $status) {
    Write-Host "Нет изменений для коммита." -ForegroundColor Yellow
    if ($Push) {
        Write-Host "[3/5] пропуск commit, попытка push..." -ForegroundColor Yellow
    } else {
        exit 0
    }
} else {
    if ($FirstCommit) { $Message = "Initial commit: ClientSay app" }
    Write-Host "[3/5] git commit: $Message" -ForegroundColor Cyan
    git commit -m $Message
}

$remotes = git remote
if ($RemoteUrl) {
    if ($remotes -notcontains "origin") {
        Write-Host "[4/5] git remote add origin" -ForegroundColor Cyan
        git remote add origin $RemoteUrl
    } else {
        $current = git remote get-url origin 2>$null
        if ($current -ne $RemoteUrl) {
            Write-Host "[4/5] git remote set-url origin" -ForegroundColor Cyan
            git remote set-url origin $RemoteUrl
        }
    }
} elseif ($Push -and ($remotes -notcontains "origin")) {
    Write-Host "Добавьте remote: -RemoteUrl `"https://github.com/USER/REPO.git`" или: git remote add origin ..." -ForegroundColor Red
    exit 1
}

if ($Push) {
    Write-Host "[5/5] git push -u origin main" -ForegroundColor Cyan
    git push -u origin main
} else {
    Write-Host "Готово (локально). Для отправки на GitHub добавьте -Push и при первом разе -RemoteUrl `"https://github.com/USER/REPO.git`"" -ForegroundColor Green
}
