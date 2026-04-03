#Requires -Version 5.1
<#
.SYNOPSIS
  Writes VPS_HOST, VPS_USER, VPS_SSH_KEY to GitHub Actions (repository secrets) via GitHub CLI.

.PREREQUISITES
  1) winget install GitHub.cli   (or https://cli.github.com/)
  2) gh auth login
     Use HTTPS, grant access to repo, include "repo" scope so secrets can be updated.

.EXAMPLE
  cd C:\Users\user\client-say-app
  powershell -ExecutionPolicy Bypass -File .\scripts\sync-github-secrets.ps1
  .\scripts\sync-github-secrets.ps1 -Repo "vadimka775319/client-say-app" -SshHost "clientsay.ru"
#>
[CmdletBinding()]
param(
  [string] $Repo = "vadimka775319/client-say-app",
  [string] $SshHost = "clientsay.ru",
  [string] $SshUser = "root",
  [string] $PrivateKeyPath = $(Join-Path $env:USERPROFILE ".ssh\clientsay_deploy")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli  then: gh auth login"
}

# gh writes "not logged in" to stderr — PowerShell 5 treats that as a terminating error if we let it through.
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
& gh auth status 2>$null 1>$null
$ghOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap
if (-not $ghOk) {
  Write-Host ""
  Write-Host "GitHub CLI is not logged in." -ForegroundColor Yellow
  Write-Host "Run once in this window, then start this script again:" -ForegroundColor Yellow
  Write-Host "  gh auth login" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Pick: GitHub.com -> HTTPS -> authenticate -> browser (or token with 'repo' scope)." -ForegroundColor DarkGray
  exit 1
}

if (-not (Test-Path -LiteralPath $PrivateKeyPath)) {
  Write-Error "Private key not found: $PrivateKeyPath"
}

$keyHead = Get-Content -LiteralPath $PrivateKeyPath -TotalCount 1 -Encoding Utf8
if ($keyHead -notmatch '^-----BEGIN ') {
  Write-Error "File must be the PRIVATE key (first line -----BEGIN ...). Path: $PrivateKeyPath"
}

Write-Host "Repo: $Repo"
Write-Host "Setting VPS_HOST = $SshHost"
gh secret set VPS_HOST --repo $Repo --body $SshHost
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Setting VPS_USER = $SshUser"
gh secret set VPS_USER --repo $Repo --body $SshUser
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Setting VPS_SSH_KEY from $PrivateKeyPath (multiline)"
$raw = Get-Content -LiteralPath $PrivateKeyPath -Raw -Encoding Utf8
if ($raw -notmatch '-----END .+PRIVATE KEY-----') {
  Write-Error "Private key file must include -----END ... PRIVATE KEY----- line"
}
$raw | gh secret set VPS_SSH_KEY --repo $Repo
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "OK. Check: gh secret list --repo $Repo"
Write-Host "Re-run deploy: Actions -> failed workflow -> Re-run jobs"
