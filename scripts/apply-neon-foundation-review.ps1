# Run once in Windows PowerShell inside the octalve-console Git checkout.
# Pulls scoped Vercel Preview secrets in memory; no manual Neon secret copying.
param([switch]$PlanOnly)
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
