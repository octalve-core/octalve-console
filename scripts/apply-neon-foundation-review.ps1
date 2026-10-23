# Run once in Windows PowerShell inside the octalve-console Git checkout.
# Pulls scoped Vercel Preview secrets in memory; no manual Neon secret copying.
param([switch]$PlanOnly, [switch]$UseNeonConsole)
$ErrorActionPreference = "Stop"
$expectedBranch = "review/cloud-foundation-qualification"
$project = "octalve-cloud-api"
$scope = "octalve-vault"
$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { throw "Open a terminal in the octalve-console repository first." }
Push-Location $repoRoot
try {
    $branch = (& git branch --show-current).Trim()
    if ($branch -ne $expectedBranch) { throw "Wrong branch: $branch. Expected $expectedBranch" }
    $dirty = @(& git status --porcelain)
    if ($dirty.Count -gt 0) { throw "Working tree is not clean. Commit or stash changes first." }
    $expectedSha = "ea201ffbdde54204be36e3350642149241c6a18c"
    # Future doc-only commits are allowed, but the migration files and lock must
    # be the same reviewed schema. Python independently checks the exact plan.
    if (-not (Test-Path "backend/scripts/review_neon_migration_cli.py")) {
        throw "Migration script unavailable. Pull the latest review branch."
    }
    $systemPython = Get-Command python -ErrorAction SilentlyContinue
    if (-not $systemPython) { throw "Python 3.12 and Node.js must be installed. No schema changes made." }
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        throw "Node.js/npx is required for Vercel CLI. No schema changes made."
    }
    $venvDir = Join-Path $env:TEMP "octalve-cloud-neon-review-venv"
    if (-not (Test-Path $venvDir)) { & python -m venv $venvDir; if ($LASTEXITCODE -ne 0) { throw "Cannot create venv." } }
    $py = Join-Path $venvDir "Scripts/python.exe"
    # Skip potentially corrupted Windows pip cache. This only installs local
    # migration-runner dependencies; it does not access or modify Neon.
    & $py -m pip install --no-cache-dir --disable-pip-version-check --quiet -r "backend/requirements.txt"
    if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed." }

    Push-Location (Join-Path $repoRoot "backend")
    try {
        if ($UseNeonConsole) {
            # Explicit fallback when the Neon CLI API and Vercel sensitive
            # Preview env pull are unavailable. The owner obtains the DIRECT
            # connection in the Neon browser, but never enters it on a command
            # line, in terminal history, chat, or a source-controlled .env.
            $managedNames = @(
                "DATABASE_URL_UNPOOLED", "OCTALVE_CLOUD_ENV", "VERCEL_ENV",
                "DEBUG", "DJANGO_SECRET_KEY", "FRONTEND_URL",
                "OCTALVE_APPROVE_FOUNDATION_SCHEMA"
            )
            $originalEnv = @{}
            foreach ($name in $managedNames) {
                $originalEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
            }
            try {
                $prompt = "Paste ONLY the Neon Preview DIRECT connection string (hidden input)"
                $secure = Read-Host -AsSecureString $prompt
                $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
                try {
                    $connection = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
                    if ([string]::IsNullOrWhiteSpace($connection)) {
                        throw "No connection string entered. Nothing applied."
                    }
                    $env:DATABASE_URL_UNPOOLED = $connection.Trim()
                } finally {
                    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
                    $secure.Dispose()
                    Remove-Variable connection -ErrorAction SilentlyContinue
                }
                $env:OCTALVE_CLOUD_ENV = "review"
                $env:VERCEL_ENV = "preview"
                $env:DEBUG = "false"
                $env:DJANGO_SECRET_KEY = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
                $env:FRONTEND_URL = "https://octalve-console-git-review-cloud-foundatio-15b74e-octalve-vault.vercel.app"
                $script = "scripts/review_neon_migration_cli.py"
                Write-Host "Verifying exact Neon branch, direct host, TLS and previously approved schema plan..."
                & $py $script plan
                if ($LASTEXITCODE -ne 0) {
                    throw "Neon Preview preflight/plan refused. No migration attempted."
                }
                if ($PlanOnly) {
                    Write-Host "PLAN VERIFIED. Database remains unchanged."
                    return
                }
                $approval = Read-Host "Type exactly APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW"
                if ($approval -cne "APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW") {
                    Write-Host "Not approved. No migration attempted."
                    return
                }
                $env:OCTALVE_APPROVE_FOUNDATION_SCHEMA = $approval
                & $py $script apply
                if ($LASTEXITCODE -ne 0) {
                    throw "Migration or verification failed: inspect actual database state before retrying."
                }
                Write-Host "SUCCESS: approved 36 Django migrations applied and verified on Foundation Preview."
                return
            } finally {
                foreach ($name in $managedNames) {
                    [Environment]::SetEnvironmentVariable($name, $originalEnv[$name], "Process")
                }
            }
        }

        # Vercel will request normal account authorization if not signed in.
        # Link only to octalve-cloud-api; never octalve-console or production.
        & npx --yes vercel@latest link --yes --project $project --scope $scope
        if ($LASTEXITCODE -ne 0) { throw "Vercel API-project linking failed." }
        $env:OCTALVE_CLOUD_ENV = "review"
        $env:VERCEL_ENV = "preview"
        $script = "scripts/review_neon_migration_cli.py"
        Write-Host "Checking the EXACT Preview database and the approved 36-migration plan..."
        & npx --yes vercel@latest env run -e preview --git-branch $expectedBranch -- $py $script plan
        if ($LASTEXITCODE -ne 0) { throw "Plan preflight failed. No migration attempted." }
        if ($PlanOnly) { Write-Host "PLAN COMPLETE: nothing applied."; return }
        $approval = Read-Host "To apply, type exactly APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW"
        if ($approval -cne "APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW") {
            Write-Host "Not approved. No migration attempted."
            return
        }
        $env:OCTALVE_APPROVE_FOUNDATION_SCHEMA = $approval
        & npx --yes vercel@latest env run -e preview --git-branch $expectedBranch -- $py $script apply
        if ($LASTEXITCODE -ne 0) { throw "Migration failed or verification incomplete; do not retry blindly." }
        Write-Host "PASS: initial Foundation Preview schema applied and ledger verified."
    } finally {
        Remove-Item Env:OCTALVE_APPROVE_FOUNDATION_SCHEMA -ErrorAction SilentlyContinue
        Pop-Location
    }
} finally {
    Pop-Location
}
