$ErrorActionPreference = "Stop"

# Configure once and run:
# powershell -ExecutionPolicy Bypass -File .\auto-deploy-watch.ps1

$ProjectPath = "D:\Client Say\client-say\client-say-app"
$TempPath = "D:\client-say-upload"
$ZipPath = "D:\client-say-app.zip"
$Server = "root@95.81.124.145"
$RemoteZip = "/root/client-say-app.zip"
$RemoteDeploy = "/root/deploy-clientsay.sh"

Write-Host "Watching $ProjectPath for changes..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

function Invoke-Deploy {
  Write-Host "[deploy] preparing archive..." -ForegroundColor DarkCyan
  Remove-Item $TempPath -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $TempPath | Out-Null
  robocopy $ProjectPath $TempPath /E /XD node_modules .next .git | Out-Null
  if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
  }
  tar -a -c -f $ZipPath -C $TempPath .
  if ($LASTEXITCODE -ne 0) {
    throw "archive create failed with exit code $LASTEXITCODE"
  }

  Write-Host "[deploy] uploading..." -ForegroundColor DarkCyan
  scp $ZipPath "$Server`:$RemoteZip"
  if ($LASTEXITCODE -ne 0) {
    throw "scp failed with exit code $LASTEXITCODE"
  }

  Write-Host "[deploy] remote deploy script..." -ForegroundColor DarkCyan
  ssh $Server $RemoteDeploy
  if ($LASTEXITCODE -ne 0) {
    throw "remote deploy script failed with exit code $LASTEXITCODE"
  }

  Write-Host "[deploy] verification..." -ForegroundColor DarkCyan
  ssh $Server "pm2 status | head -n 20"
  if ($LASTEXITCODE -ne 0) {
    throw "pm2 verification failed with exit code $LASTEXITCODE"
  }
  Write-Host "[deploy] done." -ForegroundColor Green
}

function Get-SnapshotSignature {
  $items = Get-ChildItem -Path $ProjectPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -notmatch "\\node_modules\\" -and
      $_.FullName -notmatch "\\\.next\\" -and
      $_.FullName -notmatch "\\\.git\\"
    } |
    Select-Object FullName, Length, LastWriteTimeUtc

  if (-not $items) { return "" }

  return ($items |
    Sort-Object FullName |
    ForEach-Object { "$($_.FullName)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)" }) -join "`n"
}

$lastDeployAt = Get-Date "2000-01-01"
$debounceSec = 5
$previousSignature = Get-SnapshotSignature
$isDeployRunning = $false

Write-Host "[init] first deploy on startup..." -ForegroundColor DarkYellow
try {
  Invoke-Deploy
  $lastDeployAt = Get-Date
  $previousSignature = Get-SnapshotSignature
} catch {
  Write-Host "[deploy] error: $($_.Exception.Message)" -ForegroundColor Red
}

while ($true) {
  Start-Sleep -Seconds 2
  $currentSignature = Get-SnapshotSignature
  if ($currentSignature -eq $previousSignature) { continue }
  $previousSignature = $currentSignature

  $now = Get-Date
  if (($now - $lastDeployAt).TotalSeconds -lt $debounceSec) { continue }
  if ($isDeployRunning) { continue }

  $isDeployRunning = $true
  try {
    Write-Host "[watch] changes detected: $(Get-Date -Format s)" -ForegroundColor DarkYellow
    Invoke-Deploy
    $lastDeployAt = Get-Date
  } catch {
    Write-Host "[deploy] error: $($_.Exception.Message)" -ForegroundColor Red
  } finally {
    $isDeployRunning = $false
  }
}
