# DNS-01 Production qualification: PLAN ONLY. No writes, backup deletion or migration.
# Run after the reviewed DNS-01 PR is merged and the local main is clean.
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
if ($env:CI -or $env:GITHUB_ACTIONS -or $env:VERCEL) {
    throw "Use a trusted local operator workstation, never CI or Vercel."
}
$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { throw "Open the Octalve Cloud Git checkout." }
Push-Location $root.Trim()
$names = @("DATABASE_URL","DJANGO_SECRET_KEY","OCTALVE_CLOUD_ENV","DEBUG","ALLOWED_HOSTS")
$previous = @{}
foreach ($name in $names) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name,"Process")
}
try {
    if ((& git branch --show-current).Trim() -cne "main") {
        throw "Use reviewed GitHub main, not a development branch."
    }
    if (@(& git status --porcelain).Count -ne 0) {
        throw "Local source must be clean before the Production preflight."
    }
    & git fetch origin main --quiet
    if ($LASTEXITCODE -ne 0) { throw "Unable to verify latest main." }
    if ((& git rev-parse HEAD).Trim() -cne (& git rev-parse origin/main).Trim()) {
        throw "Local main differs from origin/main. Refusing outdated code."
    }
    if (-not (Test-Path "backend/domains/migrations/0002_dns_readonly_binding.py")) {
        throw "Reviewed DNS-01 migration is not included in main."
    }
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw "Windows LOCALAPPDATA is missing."
    }
    $venv = Join-Path $env:LOCALAPPDATA "OctalveCloud\DNS01PreflightPython312"
    $python = Join-Path $venv "Scripts\python.exe"
    if (-not (Test-Path $python)) {
        $launcher = Get-Command py -ErrorAction SilentlyContinue
        if (-not $launcher) { throw "Python 3.12 launcher is required." }
        & py -3.12 -c "import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else 1)"
        if ($LASTEXITCODE -ne 0) { throw "Install Python 3.12 for Windows." }
        & py -3.12 -m venv $venv
        if ($LASTEXITCODE -ne 0) { throw "Could not build isolated Python environment." }
    }
    & $python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else 1)"
    if ($LASTEXITCODE -ne 0) { throw "Unexpected Python version." }
    & $python -m pip install --quiet --disable-pip-version-check --no-input -r "backend/requirements.txt"
    if ($LASTEXITCODE -ne 0) { throw "Python dependency qualification failed." }
    $secret = Read-Host -AsSecureString "Neon Production DIRECT database URL (hidden input)"
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { $dburl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ([string]::IsNullOrWhiteSpace($dburl)) { throw "Database URL was not provided." }
    $env:DATABASE_URL = $dburl
    $env:DJANGO_SECRET_KEY = "migration-preflight-only-"+[guid]::NewGuid().ToString("N")
    $env:OCTALVE_CLOUD_ENV = "production"
    $env:DEBUG = "false"
    $env:ALLOWED_HOSTS = "localhost,127.0.0.1"
    & $python backend/scripts/production_dns01_preflight.py plan
    if ($LASTEXITCODE -ne 0) { throw "DNS-01 Production preflight refused. No migration attempted." }
    Write-Host "Plan-only qualification complete. Database is unchanged."
}
finally {
    foreach ($name in $names) {
        [Environment]::SetEnvironmentVariable($name,$previous[$name],"Process")
    }
    Pop-Location
}
