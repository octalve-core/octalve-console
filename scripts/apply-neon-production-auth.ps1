# OCTALVE CLOUD: Production schema runner; NEVER scheduled or deployed.
# Requires direct production Neon URL, checked by Python before any SQL.
param([switch]$PlanOnly, [switch]$Apply)
$ErrorActionPreference = "Stop"
if ([bool]$PlanOnly -eq [bool]$Apply) { throw "Specify exactly one: -PlanOnly or -Apply." }
$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { throw "Open the Octalve Console Git checkout." }
Push-Location $root.Trim()
try {
  $branch = (& git branch --show-current).Trim()
  if ($branch -cne "review/cloud-auth-token-lifecycle") {
    throw "Open reviewed authentication branch, not $branch."
  }
  $status = @(& git status --porcelain)
  if ($status.Count -gt 0) { throw "Working tree must be clean before a production schema operation." }
  $pyCmd = Get-Command py -ErrorAction SilentlyContinue
  if (-not $pyCmd) { throw "Python 3.12 launcher 'py' is required; install Python 3.12 first." }
  $venv = Join-Path $env:TEMP "octalve-cloud-production-schema-venv"
  $python = Join-Path $venv "Scripts\python.exe"
  if (-not (Test-Path $python)) {
    & py -3.12 -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "Python 3.12 virtual environment failed." }
  }
  & $python -m pip install --quiet --disable-pip-version-check --no-cache-dir -r "backend/requirements.txt"
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Production DB untouched." }
  $secret = Read-Host -AsSecureString "Neon MAIN direct PostgreSQL URL (hidden, NOT pooler)"
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try {
    $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
  if ([string]::IsNullOrWhiteSpace($url)) { throw "No Production DB URL supplied." }
  $keys = @("DATABASE_URL_UNPOOLED","OCTALVE_CLOUD_ENV","OCTALVE_PRODUCTION_BACKUP_BRANCH_ID")
  $prior = @{}
  foreach ($k in $keys) { $prior[$k] = [Environment]::GetEnvironmentVariable($k, "Process") }
  try {
    $env:DATABASE_URL_UNPOOLED = $url
    $url = $null
    $env:OCTALVE_CLOUD_ENV = "production"
    $env:OCTALVE_PRODUCTION_BACKUP_BRANCH_ID = "br-wild-sea-b8dy0nsz"
    if ($PlanOnly) { & $python "backend/scripts/production_auth_schema_migration_cli.py" plan }
    else { & $python "backend/scripts/production_auth_schema_migration_cli.py" apply }
    if ($LASTEXITCODE -ne 0) { throw "Production schema runner refused or failed. Stop and investigate." }
  } finally {
    foreach ($k in $keys) {
      [Environment]::SetEnvironmentVariable($k, $prior[$k], "Process")
    }
  }
} finally { Pop-Location }
