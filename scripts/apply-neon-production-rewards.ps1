# Octalve Cloud Batch 13: single guarded local migration entry point.
# NEVER execute in CI or Vercel; requires operator-supplied Neon MAIN DIRECT URL.
# Plan-only first, independently verified recovery branch, then -Apply.
[CmdletBinding()]
param([switch]$PlanOnly, [switch]$Apply)
$ErrorActionPreference = "Stop"
if ([bool]$PlanOnly -eq [bool]$Apply) { throw "Choose exactly -PlanOnly OR -Apply" }
if ((git branch --show-current).Trim() -cne "main") { throw "Production migration only from checked-out main" }
if ((git status --porcelain).Count -ne 0) { throw "Git working tree must be completely clean" }
if (-not (Test-Path "backend/rewards/migrations/0001_initial.py")) {
    throw "Missing reviewed rewards.0001_initial migration"
}
$approvalBranch = Read-Host "Existing verified Neon Production recovery branch ID"
if ($approvalBranch -notmatch '^br-[a-z0-9-]{8,}$') {
    throw "Recovery branch ID is required. Do not proceed without a verified checkpoint."
}
$python = "python"
try {
    $secure = Read-Host -AsSecureString "Production Neon MAIN DIRECT PostgreSQL connection string (hidden)"
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $url=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ([string]::IsNullOrWhiteSpace($url)) { throw "No production connection string" }
    $oldDb=$env:DATABASE_URL
    $oldSecret=$env:DJANGO_SECRET_KEY
    $oldEnvironment=$env:OCTALVE_CLOUD_ENV
    $oldDebug=$env:DEBUG
    $oldHosts=$env:ALLOWED_HOSTS
    try {
        $env:DATABASE_URL=$url
        # Schema operations need a local throwaway key, never production auth secrets.
        $env:DJANGO_SECRET_KEY="local-migration-process-only-" + [guid]::NewGuid().ToString() + "-0123456789abc"
        $env:OCTALVE_CLOUD_ENV="production"
        $env:DEBUG="false"
        $env:ALLOWED_HOSTS="localhost,127.0.0.1"
        $preflight=@'
import os
from urllib.parse import urlsplit, parse_qs
import psycopg
u=urlsplit(os.environ["DATABASE_URL"])
if u.scheme not in ("postgresql","postgres") or not u.hostname or not u.hostname.endswith(".neon.tech"):
    raise SystemExit("REFUSED: not a recognizable Neon PostgreSQL host")
if "-pooler" in u.hostname or u.port not in (None,5432):
    raise SystemExit("REFUSED: use direct Neon port 5432, never pooler")
if not u.username or not u.password or not u.path or len(u.path)<2:
    raise SystemExit("REFUSED: complete authenticated database URL required")
if parse_qs(u.query).get("sslmode") not in (["require"],["verify-full"]):
    raise SystemExit("REFUSED: sslmode=require or verify-full required")
with psycopg.connect(os.environ["DATABASE_URL"],connect_timeout=10) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(),current_user,to_regclass('public.django_migrations')")
        database,role,ledger=cur.fetchone()
        if ledger is None:raise SystemExit("REFUSED: no existing migration ledger")
        cur.execute("SELECT app,name FROM django_migrations")
        entries=set(cur.fetchall())
        if ("rewards","0001_initial") in entries:
            raise SystemExit("Already migrated; verify separately, do not repeat.")
        if len(entries)!=54:raise SystemExit(f"REFUSED: expected 54 existing migrations, found {len(entries)}")
        if ("accounts","0003_auththrottlebucket") not in entries:
            raise SystemExit("REFUSED: missing historic authentication security baseline")
        cur.execute("SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public'")
        tables=cur.fetchone()[0]
        if tables!=100:raise SystemExit(f"REFUSED: expected 100 prior tables, found {tables}")
        print(f"PASS: Neon schema preflight; database={database}; SQL role={role}; 54 migrations; 100 tables")
'@
        $preflight | & $python -
        if ($LASTEXITCODE -ne 0) { throw "Production schema preflight refused" }
        Push-Location "backend"
        try {
            & $python "manage.py" "check"
            if ($LASTEXITCODE -ne 0) { throw "Django check refused" }
            & $python "manage.py" "makemigrations" "--check" "--dry-run"
            if ($LASTEXITCODE -ne 0) { throw "Migration source drift" }
            & $python "manage.py" "migrate" "rewards" "0001" "--plan"
            if ($LASTEXITCODE -ne 0) { throw "Unexpected migration plan" }
            if ($PlanOnly) {
                Write-Host "PLAN ONLY: no Production writes attempted. Recovery branch: $approvalBranch"
            } else {
                $confirmed=Read-Host "Type exactly APPLY REWARDS 0001 TO NEON MAIN"
                if ($confirmed -cne "APPLY REWARDS 0001 TO NEON MAIN") {
                    throw "Operator did not approve Production migration"
                }
                & $python "manage.py" "migrate" "rewards" "0001" "--noinput"
                if ($LASTEXITCODE -ne 0) { throw "Migration failed. Stop, inspect state, do not retry blindly." }
                $verify=@'
import django
django.setup()
from django.db import connection
with connection.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM django_migrations")
    assert cur.fetchone()[0]==55, "Expected 55 ledger entries"
    cur.execute("SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public'")
    assert cur.fetchone()[0]==107, "Expected 107 tables after rewards migration"
    for name in ("rewardpolicy","rewardtier","pointentry","affiliateaccount",
                 "referralattribution","commissionentry","clientrecognition"):
        cur.execute("SELECT to_regclass(%s)",("public.rewards_"+name,))
        assert cur.fetchone()[0] is not None, "Missing reviewed rewards table "+name
print("PASS: rewards.0001_initial applied, 55 migrations and 107 tables")
'@
                $verify | & $python "manage.py" "shell" "-c" "exec(__import__('sys').stdin.read())"
                if ($LASTEXITCODE -ne 0) { throw "POST-MIGRATION VERIFICATION FAILED. Keep reward API OFF." }
                Write-Host "PASS: schema verified. REWARDS_API_ENABLED must remain false until live acceptance."
            }
        } finally { Pop-Location }
    } finally {
        $env:DATABASE_URL=$oldDb
        $env:DJANGO_SECRET_KEY=$oldSecret
        $env:OCTALVE_CLOUD_ENV=$oldEnvironment
        $env:DEBUG=$oldDebug
        $env:ALLOWED_HOSTS=$oldHosts
    }
} finally {
    $url=$null
    $secure=$null
}
