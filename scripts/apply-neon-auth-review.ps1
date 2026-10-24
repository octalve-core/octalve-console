# Only the isolated auth Review branch. Never auto-run on Vercel or Production.
param([switch]$PlanOnly, [switch]$Apply)
$ErrorActionPreference = "Stop"
if ($Apply -and $PlanOnly) { throw "Choose one mode." }
if (-not $Apply -and -not $PlanOnly) { throw "Specify -PlanOnly. Schema application needs a separately authorized -Apply." }
$expectedBranch = "review/cloud-auth-token-lifecycle"
$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { throw "Open the Octalve Console checkout." }
Push-Location $repoRoot
try {
  $branch = (& git branch --show-current).Trim()
  if ($branch -cne $expectedBranch) { throw "Wrong branch: $branch. Expected $expectedBranch." }
  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) { throw "Uncommitted changes detected. No migration allowed." }
  if (-not (Test-Path "backend/scripts/review_auth_blacklist_migration_cli.py")) { throw "Auth migration runner missing." }
  if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python 3.12 required." }
  $venvDir = Join-Path $env:TEMP "octalve-cloud-auth-neon-review-venv"
  if (-not (Test-Path $venvDir)) { & python -m venv $venvDir; if ($LASTEXITCODE -ne 0) { throw "Venv failed." } }
  $py = Join-Path $venvDir "Scripts/python.exe"
  & $py -m pip install --quiet --no-cache-dir --disable-pip-version-check -r "backend/requirements.txt"
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }

  $names = @("DATABASE_URL_UNPOOLED","OCTALVE_CLOUD_ENV","VERCEL_ENV","DEBUG","DJANGO_SECRET_KEY","FRONTEND_URL",
             "OCTALVE_AUTH_SCHEMA_APPROVAL","OCTALVE_AUTH_BACKUP_BRANCH_ID")
  $original = @{}
  foreach ($name in $names) { $original[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
  try {
    $secret = Read-Host -AsSecureString "Paste ONLY the isolated Auth Review Neon DIRECT URL (hidden)"
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try {
      $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      if ([string]::IsNullOrWhiteSpace($url)) {
        throw "No URL entered. In Neon Connect, choose preview/review/cloud-auth-token-lifecycle and copy the PostgreSQL URL."
      }
      $connectionUrl = $url.Trim()
      # Neon sometimes copies the pooled endpoint by default. Restrict this
      # correction to the one verified Auth Review endpoint only. Every other
      # endpoint, including Foundation Review and Neon main, must fail closed.
      $expectedDirectHost = "ep-patient-butterfly-b8midydm.c-14.us-east-1.aws.neon.tech"
      $expectedPooledHost = "ep-patient-butterfly-b8midydm-pooler.c-14.us-east-1.aws.neon.tech"
      $hostMatch = [regex]::Match(
        $connectionUrl,
        '^(?i:postgres(?:ql)?)://[^/\s]+@(?<hostname>[^/:?]+)(?=[:/?]|$)'
      )
      if (-not $hostMatch.Success) {
        throw "Input is not a complete PostgreSQL URL. Copy only the URL starting with postgresql://, not DATABASE_URL= or quotation marks."
      }
      $enteredHost = $hostMatch.Groups["hostname"].Value.ToLowerInvariant()
      if ($enteredHost -ceq $expectedPooledHost) {
        # Only this exact Neon Auth Review pooler maps to the verified direct
        # host. Preserve the password, database, role and all URL parameters.
        $hostGroup = $hostMatch.Groups["hostname"]
        $connectionUrl = $connectionUrl.Substring(0, $hostGroup.Index) +
          $expectedDirectHost + $connectionUrl.Substring($hostGroup.Index + $hostGroup.Length)
        Write-Host "Recognized the exact Auth Review pooled endpoint. Using its verified direct hostname for migrations."
      } elseif ($enteredHost -cne $expectedDirectHost) {
        # Public hostnames are safe to display; passwords are NEVER printed.
        if ($enteredHost -ceq "ep-damp-morning-b8ll84zq.c-14.us-east-1.aws.neon.tech") {
          throw "Foundation Review connection detected. Select preview/review/cloud-auth-token-lifecycle in Neon, not Foundation Review."
        }
        throw "Wrong database branch or host ($enteredHost). Select the isolated Auth Review branch in Neon. Nothing applied."
      }
      $env:DATABASE_URL_UNPOOLED = $connectionUrl
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      $secret.Dispose()
      Remove-Variable url -ErrorAction SilentlyContinue
    }
    $env:OCTALVE_CLOUD_ENV = "review"
    $env:VERCEL_ENV = "preview"
    $env:DEBUG = "false"
    $env:DJANGO_SECRET_KEY = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
    $env:FRONTEND_URL = "https://console.cloud.octalve.com"
    Push-Location "backend"
    try {
      & $py "scripts/review_auth_blacklist_migration_cli.py" plan
      if ($LASTEXITCODE -ne 0) { throw "Auth Review preflight failed. No migration attempted." }
      if ($PlanOnly) { Write-Host "PLAN ONLY: no schema changes."; return }
      # Requires owner confirmation after independent recovery branch verification.
      Write-Host "Recovery branch identifier: br-broad-meadow-b8fg0eto"
      $backup = Read-Host "Type the exact recovery branch ID after independently verifying it"
      if ($backup -cne "br-broad-meadow-b8fg0eto") { throw "Recovery branch was not confirmed." }
      $env:OCTALVE_AUTH_BACKUP_BRANCH_ID = $backup
      $phrase = "APPLY 48 AUTH MIGRATIONS TO ISOLATED NEON AUTH REVIEW"
      $consent = Read-Host "Type exactly: $phrase"
      if ($consent -cne $phrase) { throw "Owner did not authorize schema application." }
      $env:OCTALVE_AUTH_SCHEMA_APPROVAL = $consent
      & $py "scripts/review_auth_blacklist_migration_cli.py" apply
      if ($LASTEXITCODE -ne 0) { throw "Auth Review migration failed. Inspect database before retrying." }
      Write-Host "PASS: isolated Neon Auth Review schema applied and verified."
    } finally { Pop-Location }
  } finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $original[$name], "Process") }
  }
} finally { Pop-Location }
