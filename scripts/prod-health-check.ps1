#Requires -Version 5.1
<#
.SYNOPSIS
  С ПК (PowerShell): проверка https://.../api/health и короткий заголовок главной.

.EXAMPLE
  .\scripts\prod-health-check.ps1
  .\scripts\prod-health-check.ps1 -SiteUrl "https://www.clientsay.ru"
#>
[CmdletBinding()]
param(
  [string] $SiteUrl = "https://www.clientsay.ru"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
  throw "curl.exe not found (expected Windows system curl)."
}

$base = $SiteUrl.TrimEnd("/")
Write-Host "GET $base/api/health" -ForegroundColor Cyan
$healthBody = (& curl.exe -sS "$base/api/health")
if ($LASTEXITCODE -ne 0) { throw "curl health failed: $LASTEXITCODE" }
Write-Host $healthBody
Write-Host ""

$j = $null
try {
  $j = ($healthBody.Trim()) | ConvertFrom-Json -ErrorAction Stop
}
catch {
  throw "Health check: response is not valid JSON. $($_.Exception.Message)"
}

if ($null -eq $j.PSObject.Properties["ok"]) {
  throw "Health check: JSON missing 'ok' field."
}
if (-not $j.ok) {
  $db = if ($j.PSObject.Properties.Name -contains "db") { $j.db } else { "?" }
  $auth = if ($j.PSObject.Properties.Name -contains "authSecret") { $j.authSecret } else { "n/a" }
  $code = if ($j.PSObject.Properties.Name -contains "errorCode") { $j.errorCode } else { "unknown" }
  $hintEn = if ($j.PSObject.Properties.Name -contains "hintEn") { $j.hintEn } else { $null }
  $hint = if ($hintEn) { $hintEn } elseif ($j.PSObject.Properties.Name -contains "hint") { $j.hint } else { "" }
  throw "Health ok=false errorCode=$code db=$db authSecret=$auth. $hint"
}
if ($j.db -ne "up") {
  throw "Health: db is not up ($($j.db))"
}
if ($j.PSObject.Properties.Name -contains "authReady" -and -not $j.authReady) {
  throw "Health: authReady=false - set AUTH_SECRET (>=32 chars) in production .env and restart the app."
}
Write-Host ""
Write-Host "HEAD $base/ (first line)" -ForegroundColor Cyan
& curl.exe -sS -I "$base/" | Select-Object -First 6
if ($LASTEXITCODE -ne 0) { throw "curl head failed: $LASTEXITCODE" }
