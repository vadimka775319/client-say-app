#Requires -Version 5.1
<#
.SYNOPSIS
  С ПК: SSH — записать DATABASE_URL в .env на VPS, docker compose, prisma db push (+seed), PM2.
.EXAMPLE
  npm run vps:db -- -ResetPostgresVolume -IdentityFile "$env:USERPROFILE\.ssh\clientsay_deploy"
#>
[CmdletBinding()]
param(
  [string] $SshHost = "95.81.124.145",
  [string] $SshUser = "root",
  [string] $IdentityFile = $(Join-Path $env:USERPROFILE ".ssh\clientsay_deploy"),
  [string] $VpsAppDir = "/var/www/client-say-app",
  [string] $Pm2Name = "client-say-app",
  [string] $DatabaseUrl = $env:CLIENTSAY_DATABASE_URL,
  [switch] $UseDockerComposeDefaultUrl,
  [switch] $SkipSeed,
  [switch] $ResetPostgresVolume,
  [int] $AppPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing '$Name'. $Hint"
  }
}

Ensure-Command "ssh.exe" "Install OpenSSH Client."
Ensure-Command "scp.exe" "Install OpenSSH Client (scp)."

if (-not (Test-Path -LiteralPath $IdentityFile)) {
  throw "SSH key not found: $IdentityFile"
}

$defaultUrl = "postgresql://postgres:postgres@127.0.0.1:5432/client_say?schema=public"
$urlToSet = $null
if ($UseDockerComposeDefaultUrl) {
  $urlToSet = $defaultUrl
} elseif ($DatabaseUrl -and $DatabaseUrl.Trim().Length -gt 0) {
  $urlToSet = $DatabaseUrl.Trim()
} else {
  $urlToSet = $defaultUrl
  Write-Host "Using default DATABASE_URL (docker-compose postgres)." -ForegroundColor Yellow
}

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($urlToSet))

$bash = @'
set -euo pipefail
VPS_APP_DIR="$1"
PM2_NAME="$2"
APP_PORT="$3"
DB_B64="$4"
RESET_VOL="$5"
cd "$VPS_APP_DIR"

DBURL="$(printf '%s' "$DB_B64" | base64 -d)"
if [ -f .env ]; then
  grep -v '^DATABASE_URL=' .env > .env.tmp || true
else
  : > .env.tmp
fi
printf '%s\n' "DATABASE_URL=$DBURL" >> .env.tmp
mv .env.tmp .env

if [ "$RESET_VOL" = "1" ]; then
  echo "=== docker compose down -v (removes Postgres volume; all DB data lost) ==="
  docker compose down -v
fi

echo "=== docker compose up -d ==="
docker compose up -d

echo "=== wait for Postgres (pg_isready) ==="
ready=0
for i in $(seq 1 90); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    echo "Postgres ready after ${i}s"
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != "1" ]; then
  echo "ERROR: Postgres not ready after 90s"
  exit 1
fi

echo "=== brief settle before Prisma ==="
sleep 2

echo "=== prisma db push (retries) ==="
push_ok=0
for attempt in 1 2 3 4 5; do
  echo "--- prisma db push try $attempt/5 ---"
  if npx prisma db push; then
    push_ok=1
    break
  fi
  echo "WARN: prisma db push failed, retry in 4s..."
  sleep 4
done
if [ "$push_ok" != "1" ]; then
  echo "ERROR: prisma db push failed after 5 attempts (often P1000: wrong password vs Docker volume — use -ResetPostgresVolume once)"
  exit 1
fi

echo "=== prisma generate ==="
npx prisma generate

if [ "__SEED__" = "1" ]; then
  echo "=== prisma db seed ==="
  npx prisma db seed || echo "WARN: seed failed (non-fatal)."
fi

echo "=== pm2 ==="
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start "node scripts/start-prod.cjs" --name "$PM2_NAME" --cwd "$VPS_APP_DIR" --update-env
fi

echo "=== local health (after PM2 bind delay) ==="
sleep 5
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sfS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    curl -sS "http://127.0.0.1:${APP_PORT}/api/health" || true
    echo ""
    exit 0
  fi
  sleep 2
done
echo "WARN: local curl :${APP_PORT}/api/health not ready yet (check pm2 logs). Public URL may still be OK."
echo ""
'@

$seedFlag = if ($SkipSeed) { "0" } else { "1" }
$bash = $bash.Replace("__SEED__", $seedFlag)
$bash = ($bash -replace "`r`n", "`n") -replace "`r", "`n"
$bash = $bash.TrimStart([char]0xFEFF)
$utf8 = [System.Text.UTF8Encoding]::new($false)
$buf = $utf8.GetBytes($bash)
if ($buf.Length -ge 3 -and $buf[0] -eq 0xEF -and $buf[1] -eq 0xBB -and $buf[2] -eq 0xBF) {
  $buf = [byte[]]($buf[3..($buf.Length - 1)])
}

function Escape-UnixSingleQuoted([string]$s) {
  "'" + ($s -replace "'", "'\''") + "'"
}

Write-Host "SSH: ${SshUser}@${SshHost}  dir=$VpsAppDir  pm2=$Pm2Name" -ForegroundColor Cyan
if ($ResetPostgresVolume) {
  Write-Host "-ResetPostgresVolume: docker compose down -v on server (Postgres data wiped)." -ForegroundColor Yellow
}

$resetArg = if ($ResetPostgresVolume) { "1" } else { "0" }

$tmpSh = Join-Path $env:TEMP ("clientsay-ssh-" + [guid]::NewGuid().ToString("N") + ".sh")
$remoteSh = "/tmp/clientsay-vps-" + [guid]::NewGuid().ToString("N") + ".sh"
$sshTarget = "${SshUser}@${SshHost}"
$sshOpts = @("-o", "StrictHostKeyChecking=accept-new", "-i", $IdentityFile)
try {
  [System.IO.File]::WriteAllBytes($tmpSh, $buf)
  & scp.exe @($sshOpts + @($tmpSh, "${sshTarget}:${remoteSh}"))
  if ($LASTEXITCODE -ne 0) { throw "scp failed: $LASTEXITCODE" }
  $remoteCmd =
    "bash " + $remoteSh + " " +
    (Escape-UnixSingleQuoted $VpsAppDir) + " " +
    (Escape-UnixSingleQuoted $Pm2Name) + " " +
    (Escape-UnixSingleQuoted "$AppPort") + " " +
    (Escape-UnixSingleQuoted $b64) + " " +
    (Escape-UnixSingleQuoted $resetArg)
  & ssh.exe @($sshOpts + @($sshTarget, $remoteCmd))
  if ($LASTEXITCODE -ne 0) {
    throw @"
ssh/bash exit $LASTEXITCODE
P1000: password in .env does not match Postgres volume — run once: npm run vps:db -- -ResetPostgresVolume -IdentityFile `"$IdentityFile`"
"@
  }
}
finally {
  Remove-Item -LiteralPath $tmpSh -Force -ErrorAction SilentlyContinue
  & ssh.exe @($sshOpts + @($sshTarget, "rm -f ${remoteSh}")) 2>$null | Out-Null
}

Write-Host "Next: npm run prod:health" -ForegroundColor Green
