#Requires -Version 5.1
<#
.SYNOPSIS
  Appends local .pub SSH key to ~/.ssh/authorized_keys on the VPS (for GitHub Actions deploy).

.DESCRIPTION
  Runs scp then ssh. You will be prompted for the SSH password (usually twice).

.EXAMPLE
  .\scripts\install-deploy-key.ps1
  .\scripts\install-deploy-key.ps1 -SshHost clientsay.ru -User root
#>
[CmdletBinding()]
param(
  [Parameter()]
  [Alias("HostName")]
  [string] $SshHost = "clientsay.ru",

  [Parameter()]
  [string] $User = "root",

  [Parameter()]
  [string] $PubKeyPath = $(Join-Path $env:USERPROFILE ".ssh\clientsay_deploy.pub")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PubKeyPath)) {
  Write-Error "Public key file not found: $PubKeyPath"
}

$first = (Get-Content -LiteralPath $PubKeyPath -Encoding Utf8 | Select-Object -First 1).Trim()
if ($first -notmatch "^ssh-(ed25519|rsa|ecdsa)") {
  Write-Error "Expected a .pub line starting with ssh-ed25519 / ssh-rsa / ssh-ecdsa"
}

$sshTarget = "${User}@${SshHost}"
$remoteTmp = "/tmp/clientsay_deploy_add.pub"
$sshOpts = @("-o", "StrictHostKeyChecking=accept-new")

Write-Host "Target: $sshTarget"
Write-Host "Public key file: $PubKeyPath"
Write-Host ""

& scp.exe @sshOpts $PubKeyPath "${sshTarget}:${remoteTmp}"
if ($LASTEXITCODE -ne 0) {
  Write-Error "scp failed with exit code $LASTEXITCODE"
}

$remoteOneLine = 'umask 077; mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh" && f="$HOME/.ssh/authorized_keys" && touch "$f" && chmod 600 "$f" && k=$(sed "s/\r$//" /tmp/clientsay_deploy_add.pub | head -1) && rm -f /tmp/clientsay_deploy_add.pub && { test -n "$k" || { echo "empty key line" >&2; exit 1; }; } && if grep -qxF "$k" "$f" 2>/dev/null; then echo "Key already in authorized_keys."; else echo "$k" >> "$f" && echo "Key added."; fi'

& ssh.exe @sshOpts $sshTarget $remoteOneLine
if ($LASTEXITCODE -ne 0) {
  Write-Error "ssh failed with exit code $LASTEXITCODE"
}

$priv = if ($PubKeyPath.EndsWith(".pub")) { $PubKeyPath.Substring(0, $PubKeyPath.Length - 4) } else { $PubKeyPath }

Write-Host ""
Write-Host "Test passwordless login:"
Write-Host ("  ssh -o IdentitiesOnly=yes -o IdentityFile=`"" + $priv + "`" " + $sshTarget)
Write-Host ""
Write-Host "GitHub repo secret VPS_SSH_KEY: paste full private key file contents:"
Write-Host ("  " + $priv)
