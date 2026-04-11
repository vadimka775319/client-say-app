#Requires -Version 5.1
<#
.SYNOPSIS
  С ПК: по SSH — docker, pg_isready, DATABASE_URL (маска), curl /api/health на 127.0.0.1.
.EXAMPLE
  .\scripts\vps-diagnose.ps1 -IdentityFile "$env:USERPROFILE\.ssh\clientsay_deploy"
#>
[CmdletBinding()]
param(
  [string] $SshHost = "95.81.124.145",
  [string] $SshUser = "root",
  [string] $IdentityFile = $(Join-Path $env:USERPROFILE ".ssh\clientsay_deploy"),
  [string] $VpsAppDir = "/var/www/client-say-app",
  [int] $AppPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "SSH key not found: $IdentityFile" }
if (-not (Get-Command scp.exe -ErrorAction SilentlyContinue)) { throw "scp.exe not found (OpenSSH Client)." }
if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) { throw "ssh.exe not found (OpenSSH Client)." }

function Escape-UnixSingleQuoted([string]$s) {
  "'" + ($s -replace "'", "'\''") + "'"
}

$bash = @'
set -eu
cd "$1"
PORT="$2"
echo "=== pwd ==="
pwd
echo "=== docker compose ps ==="
docker compose ps || true
echo "=== pg_isready (service db) ==="
docker compose exec -T db pg_isready -U postgres 2>&1 || echo "pg_isready: FAILED"
echo "=== DATABASE_URL in .env (password masked) ==="
if [ -f .env ]; then
  (grep -E '^DATABASE_URL=' .env 2>/dev/null || true) | sed -E 's#(postgresql://[^:]+:)[^@]+#\1***#' || true
  if ! grep -qE '^DATABASE_URL=' .env 2>/dev/null; then echo "(no DATABASE_URL line)"; fi
else
  echo "MISSING .env file"
fi
echo "=== DATABASE_URL in other env files (last wins in start-prod; password masked) ==="
for f in .env.production .env.local .env.production.local; do
  if [ -f "$f" ]; then
    if grep -qE '^DATABASE_URL=' "$f" 2>/dev/null; then
      echo "--- $f ---"
      grep -E '^DATABASE_URL=' "$f" | sed -E 's#(postgresql://[^:]+:)[^@]+#\1***#'
    fi
  fi
done
echo "=== Prisma connect (same .env chain as PM2 start-prod) ==="
if [ -f scripts/vps-diag-prisma.cjs ]; then
  node scripts/vps-diag-prisma.cjs || true
else
  echo "(skip: scripts/vps-diag-prisma.cjs not deployed yet)"
fi
echo "=== curl http://127.0.0.1:${PORT}/api/health ==="
curl -sS "http://127.0.0.1:${PORT}/api/health" || echo "curl health: FAILED"
echo "=== DONE ==="
'@

$bash = ($bash -replace "`r`n", "`n") -replace "`r", "`n"
$bash = $bash.TrimStart([char]0xFEFF)
$utf8 = [System.Text.UTF8Encoding]::new($false)
$buf = $utf8.GetBytes($bash)
if ($buf.Length -ge 3 -and $buf[0] -eq 0xEF -and $buf[1] -eq 0xBB -and $buf[2] -eq 0xBF) {
  $buf = [byte[]]($buf[3..($buf.Length - 1)])
}

$tmpSh = Join-Path $env:TEMP ("clientsay-ssh-" + [guid]::NewGuid().ToString("N") + ".sh")
$remoteSh = "/tmp/clientsay-diag-" + [guid]::NewGuid().ToString("N") + ".sh"
$sshTarget = "${SshUser}@${SshHost}"
$sshOpts = @("-o", "StrictHostKeyChecking=accept-new", "-i", $IdentityFile)
try {
  [System.IO.File]::WriteAllBytes($tmpSh, $buf)
  & scp.exe @($sshOpts + @($tmpSh, "${sshTarget}:${remoteSh}"))
  if ($LASTEXITCODE -ne 0) { throw "scp failed: $LASTEXITCODE" }
  $remoteCmd = "bash " + $remoteSh + " " + (Escape-UnixSingleQuoted $VpsAppDir) + " " + (Escape-UnixSingleQuoted "$AppPort")
  & ssh.exe @($sshOpts + @($sshTarget, $remoteCmd))
  if ($LASTEXITCODE -ne 0) { throw "ssh bash failed: $LASTEXITCODE" }
}
finally {
  Remove-Item -LiteralPath $tmpSh -Force -ErrorAction SilentlyContinue
  & ssh.exe @($sshOpts + @($sshTarget, "rm -f ${remoteSh}")) 2>$null | Out-Null
}
