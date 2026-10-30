# Windows-only, review-gated Octalve Settings Batch 2 Production schema runner.
# From clean github main after PR #101 merge:
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-production-settings-batch2.ps1 -PlanOnly
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-production-settings-batch2.ps1 -Apply
# NEVER invoke from CI/Vercel; never paste or print the DB credential.
[CmdletBinding()]
param([switch]$PlanOnly,[switch]$Apply)
$ErrorActionPreference="Stop"
if ([bool]$PlanOnly -eq [bool]$Apply) { throw "Choose exactly -PlanOnly or -Apply." }
if ($env:CI -or $env:GITHUB_ACTIONS -or $env:VERCEL) { throw "Local trusted workstation required." }
$root=(& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { throw "Open the octalve-console Git checkout." }
Push-Location $root.Trim()
$backups=@{}
$keys=@("DATABASE_URL","DJANGO_SECRET_KEY","OCTALVE_CLOUD_ENV","DEBUG","ALLOWED_HOSTS",
        "OCTALVE_SETTINGS_LOCAL_BACKUP_VERIFIED","OCTALVE_SETTINGS_LOCAL_BACKUP_FILE",
        "OCTALVE_SETTINGS_LOCAL_BACKUP_SHA256","PGHOST","PGPORT","PGDATABASE","PGUSER",
        "PGPASSWORD","PGSSLMODE")
foreach($name in $keys){ $backups[$name]=[Environment]::GetEnvironmentVariable($name,"Process") }
try{
    if ((& git branch --show-current).Trim() -cne "main") {throw "Must checkout reviewed main, not a feature branch."}
    if (@(& git status --porcelain).Count -ne 0) {throw "Working tree must be clean."}
    & git fetch origin main --quiet
    if ($LASTEXITCODE -ne 0){throw "Could not fetch latest main."}
    $local=(& git rev-parse HEAD).Trim()
    $remote=(& git rev-parse origin/main).Trim()
    if ($local -cne $remote){throw "Local main differs from origin/main. Fetch/fast-forward, do not override."}
    foreach($m in @("0002_console_policy_defaults","0003_mail_template_outbox",
                   "0004_seed_mail_templates","0005_tax_policy_revision")){
        if (-not (Test-Path "backend/settings_registry/migrations/$m.py")) {
           throw "Settings migration source missing: $m"
        }
    }
    # Use the prior Production auth runner's isolated Python 3.12 approach.
    # This environment lives OUTSIDE Git so the source tree stays clean.
    if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){
        throw "Windows LOCALAPPDATA is missing. Open PowerShell on your trusted Windows workstation."
    }
    $venv=Join-Path $env:LOCALAPPDATA "OctalveCloud\Batch2MigrationPython312"
    $python=Join-Path $venv "Scripts\python.exe"
    if(-not (Test-Path $python)){
        $launcher=Get-Command py -ErrorAction SilentlyContinue
        if($launcher){
            # The Python Launcher selects Python 3.12 even if another version is default.
            & py -3.12 -c "import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else 1)"
            if($LASTEXITCODE -ne 0){throw "Python 3.12 is required. Install Python 3.12 for Windows and rerun."}
            & py -3.12 -m venv $venv
        }else{
            $candidate=Get-Command python -ErrorAction SilentlyContinue
            if(-not $candidate){throw "Python 3.12 was not found. Install it and rerun the same script."}
            & python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else 1)"
            if($LASTEXITCODE -ne 0){throw "Python 3.12 is required; the default python is a different version. Install the 3.12 launcher."}
            & python -m venv $venv
        }
        if($LASTEXITCODE -ne 0 -or -not (Test-Path $python)){
            throw "Could not create isolated Python 3.12 migration environment. Production is unchanged."
        }
    }
    & $python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else 1)"
    if($LASTEXITCODE -ne 0){throw "Migration environment is not Python 3.12. Do not reuse it; Production is unchanged."}
    Write-Host "Preparing pinned Django dependencies in an isolated local environment..."
    & $python -m pip install --quiet --disable-pip-version-check --no-input -r "backend/requirements.txt"
    if($LASTEXITCODE -ne 0){throw "Pinned Django dependency setup failed. Production is unchanged. Check Python 3.12 and your network."}
    & $python -c "import django,psycopg; print('PASS: Django and psycopg ready for isolated migration preflight')"
    if($LASTEXITCODE -ne 0){throw "The isolated migration environment is incomplete. Production is unchanged."}
    $secure=Read-Host -AsSecureString "Neon Production direct PostgreSQL URL (input hidden)"
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try{$url=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
    finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
    if ([string]::IsNullOrWhiteSpace($url)){throw "No Production URL."}
    $env:DATABASE_URL=$url
    $env:DJANGO_SECRET_KEY="migration-only-"+[guid]::NewGuid().ToString("N")+"-unrelated-to-live-auth"
    $env:OCTALVE_CLOUD_ENV="production"
    $env:DEBUG="false"
    $env:ALLOWED_HOSTS="localhost,127.0.0.1"
    & $python backend/scripts/production_settings_batch2_migrate.py plan
    if($LASTEXITCODE -ne 0){throw "Production plan failed. No writes attempted."}
    Push-Location backend
    try{
        & $python manage.py check
        if($LASTEXITCODE -ne 0){throw "Django check failed."}
        & $python manage.py makemigrations --check --dry-run
        if($LASTEXITCODE -ne 0){throw "Uncommitted source migrations detected."}
    }finally{Pop-Location}
    if($PlanOnly){Write-Host "PASS: read-only production preflight complete. No DB writes.";return}

    # Windows PostgreSQL installers often do not add their bin directory to PATH.
    # Discover the matching pg_dump/pg_restore pair without changing global PATH.
    $pgDump=Get-Command pg_dump -ErrorAction SilentlyContinue
    $pgRestore=Get-Command pg_restore -ErrorAction SilentlyContinue
    if(-not $pgDump -or -not $pgRestore){
        $pgBase=Join-Path $env:ProgramFiles "PostgreSQL"
        if(Test-Path $pgBase){
            $releases=@(Get-ChildItem -Path $pgBase -Directory | Sort-Object Name -Descending)
            foreach($release in $releases){
                $dumpCandidate=Join-Path $release.FullName "bin\pg_dump.exe"
                $restoreCandidate=Join-Path $release.FullName "bin\pg_restore.exe"
                if((Test-Path $dumpCandidate) -and (Test-Path $restoreCandidate)){
                    $pgDump=$dumpCandidate
                    $pgRestore=$restoreCandidate
                    break
                }
            }
        }
    }
    if(-not $pgDump -or -not $pgRestore){
        throw "Install PostgreSQL client tools (pg_dump and pg_restore). No backup or migration was attempted. See https://www.postgresql.org/download/windows/."
    }
    $dburi=[Uri]$url
    $parts=$dburi.UserInfo.Split(":",2)
    if($parts.Count -ne 2){throw "Invalid database role format."}
    $env:PGUSER=[Uri]::UnescapeDataString($parts[0])
    $env:PGPASSWORD=[Uri]::UnescapeDataString($parts[1])
    $env:PGHOST=$dburi.Host
    $env:PGPORT="5432"
    $env:PGDATABASE="neondb"
    $env:PGSSLMODE="require"
    $folder=Join-Path $env:LOCALAPPDATA "OctalveCloud\ProtectedDatabaseBackups"
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    $archive=Join-Path $folder ("pre-settings-batch2-"+(Get-Date -Format "yyyyMMdd-HHmmss")+".dump")
    & $pgDump --format=custom --no-owner --no-privileges --file="$archive"
    if($LASTEXITCODE -ne 0){throw "Production backup failed. Migration refused."}
    $toc=@(& $pgRestore --list "$archive")
    if($LASTEXITCODE -ne 0 -or $toc.Count -lt 100){throw "Backup archive could not be listed reliably. Migration refused."}
    $info=Get-Item $archive
    if($info.Length -lt 10000){throw "Suspiciously small backup. Migration refused."}
    $hash=(Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $env:OCTALVE_SETTINGS_LOCAL_BACKUP_FILE=$archive
    $env:OCTALVE_SETTINGS_LOCAL_BACKUP_SHA256=$hash
    $env:OCTALVE_SETTINGS_LOCAL_BACKUP_VERIFIED="true"
    Write-Host "PASS: backup archive checksum, size and TOC verified in a private local folder."
    Write-Host "Keep this archive on an encrypted drive and test a restore in an isolated database."
    # The Python runner independently validates archive checksum/DB identity,
    # then asks for a second exact typed approval before Django migrates.
    & $python backend/scripts/production_settings_batch2_migrate.py apply
    if($LASTEXITCODE -ne 0){throw "Database migration refused/failed. Do not deploy; inspect current state."}
    Write-Host "MIGRATION ACCEPTED: verify Neon ledger and the API release independently."
}
finally{
    foreach($name in $keys){
        [Environment]::SetEnvironmentVariable($name,$backups[$name],"Process")
    }
    Pop-Location
}
