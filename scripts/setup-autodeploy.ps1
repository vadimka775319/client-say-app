#Requires -Version 5.1
<#
.SYNOPSIS
  One-command setup for GitHub Actions autodeploy to VPS.

.DESCRIPTION
  1) Creates deploy SSH key pair (if absent)
  2) Installs public key on VPS (password prompt from ssh/scp)
  3) Syncs GitHub secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)
  4) Sets PUBLIC_SITE_URL and VPS_APP_DIR
  5) Triggers deploy workflow via empty commit (optional)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-autodeploy.ps1 `
    -Repo "vadimka775319/client-say-app" `
    -SshHost "95.81.124.145" `
    -SshUser "root" `
    -PublicSiteUrl "https://www.clientsay.ru" `
    -VpsAppDir "/var/www/client-say-app"
#>
[CmdletBinding()]
param(
  [string] $Repo = "vadimka775319/client-say-app",
  [string] $SshHost = "95.81.124.145",
  [string] $SshUser = "root",
  [string] $PublicSiteUrl = "https://www.clientsay.ru",
  [string] $VpsAppDir = "/var/www/client-say-app",
  [string] $PrivateKeyPath = $(Join-Path $env:USERPROFILE ".ssh\clientsay_deploy"),
  [switch] $SkipDeployTrigger
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing command '$Name'. $InstallHint"
  }
}

Ensure-Command "ssh.exe" "Install OpenSSH Client (Windows optional feature)."
Ensure-Command "scp.exe" "Install OpenSSH Client (Windows optional feature)."
Ensure-Command "gh" "Install GitHub CLI: winget install GitHub.cli ; then run 'gh auth login'."

if (-not (Test-Path (Split-Path -Parent $PrivateKeyPath))) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PrivateKeyPath) | Out-Null
}

if (-not (Test-Path -LiteralPath $PrivateKeyPath)) {
  Write-Host "Generating deploy key: $PrivateKeyPath"
  & ssh-keygen.exe -t ed25519 -C "clientsay-deploy" -f $PrivateKeyPath -N ""
  if ($LASTEXITCODE -ne 0) { throw "ssh-keygen failed with exit code $LASTEXITCODE" }
} else {
  Write-Host "Using existing key: $PrivateKeyPath"
}

$pub = "$PrivateKeyPath.pub"
if (-not (Test-Path -LiteralPath $pub)) {
  throw "Public key not found: $pub"
}

Write-Host ""
Write-Host "Step 1/4: Install deploy key on VPS ($SshUser@$SshHost)"
& powershell -ExecutionPolicy Bypass -File ".\scripts\install-deploy-key.ps1" -SshHost $SshHost -User $SshUser -PubKeyPath $pub
if ($LASTEXITCODE -ne 0) { throw "install-deploy-key.ps1 failed with exit code $LASTEXITCODE" }

Write-Host ""
Write-Host "Step 2/4: Sync core GitHub secrets"
& powershell -ExecutionPolicy Bypass -File ".\scripts\sync-github-secrets.ps1" `
  -Repo $Repo -SshHost $SshHost -SshUser $SshUser -PrivateKeyPath $PrivateKeyPath
if ($LASTEXITCODE -ne 0) { throw "sync-github-secrets.ps1 failed with exit code $LASTEXITCODE" }

Write-Host ""
Write-Host "Step 3/4: Set PUBLIC_SITE_URL and VPS_APP_DIR"
gh secret set PUBLIC_SITE_URL --repo $Repo --body $PublicSiteUrl
if ($LASTEXITCODE -ne 0) { throw "Failed setting PUBLIC_SITE_URL" }
gh secret set VPS_APP_DIR --repo $Repo --body $VpsAppDir
if ($LASTEXITCODE -ne 0) { throw "Failed setting VPS_APP_DIR" }

if (-not $SkipDeployTrigger) {
  Write-Host ""
  Write-Host "Step 4/4: Trigger deploy workflow with empty commit"
  git rev-parse --is-inside-work-tree | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Run script from repository root." }
  git commit --allow-empty -m "chore(deploy): trigger autodeploy setup check" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to create empty commit" }
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw "Failed to push main" }
}

Write-Host ""
Write-Host "Done."
Write-Host "Workflow runs: https://github.com/$Repo/actions"
