@echo off
chcp 65001 >nul
cd /d "%~dp0.."

REM Укажи URL своего репозитория GitHub (один раз), например:
REM set "GITHUB_REPO_URL=https://github.com/username/client-say-app.git"
if not defined GITHUB_REPO_URL (
  set "GITHUB_REPO_URL="
)

if defined GITHUB_REPO_URL (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-github.ps1" -Message "Update ClientSay" -RemoteUrl "%GITHUB_REPO_URL%" -Push
) else (
  echo URL не задан. Отредактируй scripts\sync-github.cmd: строка set GITHUB_REPO_URL=...
  echo или в PowerShell: $env:GITHUB_REPO_URL="https://github.com/USER/REPO.git"
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-github.ps1" -Message "Update ClientSay"
)
echo.
pause
