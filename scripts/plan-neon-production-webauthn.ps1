# Octalve Cloud AUTH-02: reviewed local Neon Production migration.
# Windows PowerShell 5.1 or PowerShell 7, clean octalve-core/octalve-console main.
# powershell -ExecutionPolicy Bypass -File .\scripts\plan-neon-production-webauthn.ps1 -Preflight
# powershell -ExecutionPolicy Bypass -File .\scripts\plan-neon-production-webauthn.ps1 -Apply
# Apply repeats preflight, makes fresh pg_dump, restores entire data archive to
# disposable loopback-only PostgreSQL, then requests typed schema approval.
[CmdletBinding()]
param([switch]$Preflight,[switch]$Apply,[switch]$PlanOnly,[switch]$BackupOnly,[Parameter(Mandatory=$true)][ValidatePattern("^[0-9a-f]{40}$")][string]$ApprovedCommit,[string]$PostgresBin="")
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$selected=[int][bool]$Preflight+[int][bool]$Apply+[int][bool]$PlanOnly+[int][bool]$BackupOnly
if($selected -ne 1){throw 'Choose exactly -Preflight, -PlanOnly, -BackupOnly or -Apply.'}
if($env:CI -or $env:GITHUB_ACTIONS -or $env:VERCEL){throw 'Trusted local Windows operator only; CI and Vercel prohibited.'}
$root=(& git rev-parse --show-toplevel 2>$null)
if($LASTEXITCODE -ne 0 -or -not $root){throw 'Open your octalve-core/octalve-console Git checkout.'}
Push-Location $root.Trim()
$keys=@('DATABASE_URL','DJANGO_SECRET_KEY','OCTALVE_CLOUD_ENV','DEBUG','ALLOWED_HOSTS','FRONTEND_URL',
 'OCTALVE_WEBAUTHN_SOURCE_APPROVED','OCTALVE_WEBAUTHN_BACKUP_VERIFIED','OCTALVE_WEBAUTHN_RESTORE_VERIFIED',
 'OCTALVE_WEBAUTHN_BACKUP_FILE','OCTALVE_WEBAUTHN_BACKUP_SHA256','OCTALVE_WEBAUTHN_RESTORE_SHA256',
 'OCTALVE_WEBAUTHN_RESTORE_AT','OCTALVE_WEBAUTHN_LEDGER_SHA256','CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED','CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE')
$previous=@{}
foreach($key in $keys){$previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$pgCtl=$null;$cluster=$null;$started=$false;$dbUrl=$null;$passFile=$null
try{
  if((& git branch --show-current).Trim() -cne 'main'){throw 'Only reviewed main may migrate Production.'}
  $dirty=@(& git status --porcelain --untracked-files=all)
  if($LASTEXITCODE -ne 0){throw 'Could not verify local Git working tree.'}
  if($dirty.Count -ne 0){
    Write-Warning ('Uncommitted or untracked local paths (first 12): '+(($dirty | Select-Object -First 12) -join '; '))
    throw 'Git working tree is not clean. Preserve local work; inspect git status before continuing.'
  }
  $origin=(& git remote get-url origin).Trim()
  if($LASTEXITCODE -ne 0 -or $origin -notmatch '^(https://github[.]com/|git@github[.]com:)octalve-core/octalve-console([.]git)?/?$'){
    throw 'Wrong repository origin. Refusing Production migration.'
  }
  & git fetch --quiet origin main
  if($LASTEXITCODE -ne 0){throw 'Could not fetch GitHub main.'}
  if((& git rev-parse HEAD).Trim() -cne (& git rev-parse origin/main).Trim()){
    throw 'Local main differs from GitHub main. Run git pull --ff-only first.'
  }
  if((& git rev-parse HEAD).Trim() -cne $ApprovedCommit){throw 'Local main is not the exact approved release commit.'}
  foreach($migration in @('0004_privileged_webauthn.py','0005_privileged_passkey_enrollment.py')){
    if(-not (Test-Path (Join-Path 'backend/accounts/migrations' $migration))){throw 'AUTH-02 migration is missing.'}
  }
  if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'Windows LOCALAPPDATA missing.'}
  $venv=Join-Path $env:LOCALAPPDATA 'OctalveCloud\WEBAUTHNReleasePython312'
  $python=Join-Path $venv 'Scripts\python.exe'
  if(-not (Test-Path $python)){
    & py -3.12 -c 'import sys; sys.exit(0 if sys.version_info[:2]==(3,12) else 1)'
    if($LASTEXITCODE -ne 0){throw 'Python 3.12 required.'}
    & py -3.12 -m venv $venv
    if($LASTEXITCODE -ne 0){throw 'Python environment setup failed.'}
  }
  & $python -c 'import sys; sys.exit(0 if sys.version_info[:2]==(3,12) else 1)'
  if($LASTEXITCODE -ne 0){throw 'Incorrect Python version.'}
  & $python -m pip install --quiet --disable-pip-version-check --no-input -r backend/requirements.txt
  if($LASTEXITCODE -ne 0){throw 'Pinned Python dependencies could not be prepared.'}
  $secure=Read-Host -AsSecureString 'Neon Production DIRECT database URL (hidden)'
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{$dbUrl=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
  if([string]::IsNullOrWhiteSpace($dbUrl)){throw 'Database URL missing.'}
  $env:DATABASE_URL=$dbUrl
  $env:DJANGO_SECRET_KEY='webauthn-migration-only-'+[guid]::NewGuid().ToString('N')
  $env:OCTALVE_CLOUD_ENV='production';$env:DEBUG='false';$env:ALLOWED_HOSTS='localhost,127.0.0.1'
  # Django settings requires FRONTEND_URL on import. This is the existing
  # Console origin, not a newly supplied credential or network operation.
  # Restore the operator's previous value in finally, as with other settings.
  $env:FRONTEND_URL='https://console.cloud.octalve.com'
  $env:CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED='false';$env:CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED='false'
  & $python backend/scripts/production_webauthn_preflight.py plan
  if($LASTEXITCODE -ne 0){throw 'Neon Production preflight refused.'}
  Push-Location backend
  try{
    & $python manage.py check
    if($LASTEXITCODE -ne 0){throw 'Django check failed.'}
    & $python manage.py makemigrations --check --dry-run
    if($LASTEXITCODE -ne 0){throw 'Unexpected uncommitted migration change.'}
  } finally {Pop-Location}
  Write-Host 'PREFLIGHT PASSED: exact Production database, original ledger and exactly two reviewed WebAuthn migrations.'
  if(-not ($Apply -or $BackupOnly)){Write-Host 'No database changes were made.';return}

  # An explicit tool directory is optional. It lets the operator use the
  # official portable PostgreSQL 18.7 binaries without replacing a separate
  # locally running PostgreSQL service or cloning this repository again.
  $candidates=@()
  if($PostgresBin){
    if(-not [IO.Path]::IsPathRooted($PostgresBin) -or
        -not (Test-Path -LiteralPath $PostgresBin -PathType Container)){
      throw 'Provide an existing absolute PostgreSQL 18.7 bin directory in -PostgresBin.'
    }
    $candidates+=([IO.Path]::GetFullPath($PostgresBin))
  }else{
    $found=Get-Command pg_dump.exe -ErrorAction SilentlyContinue
    if($found){$candidates+=(Split-Path -Parent $found.Source)}
    $pgHome=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'PostgreSQL'
    if(Test-Path $pgHome){
      $candidates+=@(Get-ChildItem $pgHome -Directory | Sort-Object Name -Descending |
        ForEach-Object {Join-Path $_.FullName 'bin'})
    }
  }
  # Neon currently runs patched PostgreSQL 18.7. PostgreSQL 18.3 does not
  # understand the pg_attver column metadata introduced by recent upstream
  # composite-type security fixes. A restore against an older server is NOT
  # evidence of recoverability; never strip metadata or ignore restore errors.
  # Require ONE complete, same-build, patched 18.x toolchain for both the
  # custom pg_dump archive and the independently initialized restore server.
  $pgBin=$null
  $requiredPgTools=@('pg_dump.exe','pg_restore.exe','psql.exe',
                     'initdb.exe','pg_ctl.exe','postgres.exe')
  foreach($dir in @($candidates | Select-Object -Unique)){
    if(@($requiredPgTools | Where-Object {-not (Test-Path -LiteralPath (Join-Path $dir $_))}).Count -ne 0){continue}
    $versions=@()
    $compatible=$true
    foreach($tool in $requiredPgTools){
      $exe=Join-Path $dir $tool
      try{
        $versionText=(& $exe --version 2>&1 | Out-String).Trim()
        if($LASTEXITCODE -ne 0){$compatible=$false;break}
        $match=[regex]::Match($versionText,'\(PostgreSQL\)\s+18\.([0-9]+)(?:\s|$)')
        if(-not $match.Success -or [int]$match.Groups[1].Value -lt 7){
          $compatible=$false;break
        }
        $versions+=('18.'+$match.Groups[1].Value)
      }catch{
        $compatible=$false;break
      }
    }
    if($compatible -and @($versions | Select-Object -Unique).Count -eq 1){
      $pgBin=$dir
      $pgVersion=$versions[0]
      break
    }
  }
  if(-not $pgBin){
    throw ('Independent full-data restore requires a complete patched PostgreSQL 18.7'+
      ' (or newer 18.x) Windows toolchain (all six binaries, same minor release). '+
      'Your earlier PostgreSQL 18.3 installation cannot safely restore the '+
      'Neon 18.7 archive containing pg_attver. Update PostgreSQL from '+
      'https://www.postgresql.org/download/windows/ and retry; never edit '+
      'the backup or bypass --exit-on-error.')
  }
  Write-Host "PASS: compatible patched PostgreSQL $pgVersion toolchain selected for backup and isolated restore."
  $pgDump=Join-Path $pgBin 'pg_dump.exe';$pgRestore=Join-Path $pgBin 'pg_restore.exe'
  $pgInit=Join-Path $pgBin 'initdb.exe';$pgCtl=Join-Path $pgBin 'pg_ctl.exe';$psql=Join-Path $pgBin 'psql.exe'
  $dbUri=[Uri]$dbUrl;$parts=$dbUri.UserInfo.Split(':',2)
  if($parts.Count -ne 2){throw 'Invalid database user format.'}
  $env:PGUSER=[Uri]::UnescapeDataString($parts[0]);$env:PGPASSWORD=[Uri]::UnescapeDataString($parts[1])
  $env:PGHOST=$dbUri.Host;$env:PGPORT='5432';$env:PGDATABASE='neondb';$env:PGSSLMODE='require'
  if($dbUri.Query -match '(?:^\?|&)sslmode=verify-full(?:&|$)'){$env:PGSSLMODE='verify-full'}
  if((Read-Host 'Confirm workstation and backup volume are encrypted and access-restricted; type PROTECTED STORAGE') -cne 'PROTECTED STORAGE'){throw 'Protected backup storage not attested.'}
  $folder=Join-Path $env:LOCALAPPDATA 'OctalveCloud\ProtectedDatabaseBackups'
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $archive=Join-Path $folder ('pre-webauthn-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')
  if(Test-Path $archive){throw 'Backup archive collision; never overwrite.'}
  $ledgerQuery=@'
SELECT encode(sha256(convert_to(string_agg(app || ':' || name, chr(10) ORDER BY app COLLATE "C", name COLLATE "C"),'UTF8')),'hex') FROM public.django_migrations
'@
  $beforeLedger=(& $psql -X -v ON_ERROR_STOP=1 --tuples-only --no-align --quiet -c "$ledgerQuery" | Select-Object -Last 1)
  if($LASTEXITCODE -ne 0 -or $beforeLedger -notmatch '^[0-9a-f]{64}$'){throw 'Production ledger digest failed.'}
  & $pgDump --format=custom --file="$archive"
  if($LASTEXITCODE -ne 0){throw 'Fresh pg_dump failed. No Production schema changed.'}
  if((Get-Item $archive).Length -lt 10000){throw 'Backup unexpectedly small.'}
  $toc=@(& $pgRestore --list "$archive")
  if($LASTEXITCODE -ne 0 -or $toc.Count -lt 100){throw 'Custom archive verification failed.'}
  $sha=(Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host 'Fresh Production backup preserved (including database object ownership and grants).'

  # Loopback-only restore drill. Never use existing Production/Preview databases.
  $parent=Join-Path $env:LOCALAPPDATA 'OctalveCloud\RestoreDrills'
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $cluster=Join-Path $parent ([guid]::NewGuid().ToString('N'))
  # Local scratch server still requires a distinct strong SCRAM password.
  # Do not expose customer data through passwordless local PostgreSQL.
  $randomBytes=New-Object byte[] 32
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($randomBytes)}finally{$rng.Dispose()}
  $localPassword=[Convert]::ToBase64String($randomBytes)
  $passFile=Join-Path $parent ([guid]::NewGuid().ToString('N')+'.pw')
  [IO.File]::WriteAllText($passFile,$localPassword,[Text.Encoding]::ASCII)
  $listener=New-Object -TypeName System.Net.Sockets.TcpListener -ArgumentList @([Net.IPAddress]::Loopback,0)
  $listener.Start()
  try{$port=([Net.IPEndPoint]$listener.LocalEndpoint).Port}finally{$listener.Stop()}
  & $pgInit -D "$cluster" -U octalve_webauthn_restore -A scram-sha-256 --pwfile="$passFile" --encoding=UTF8 --no-instructions
  $initExit=$LASTEXITCODE
  if(Test-Path $passFile){Remove-Item -LiteralPath $passFile -Force}
  $passFile=$null
  if($initExit -ne 0){throw 'Temporary restore database initialization failed.'}
  $env:PGPASSWORD=$localPassword
  $localPassword=$null
  & $pgCtl -D "$cluster" -l (Join-Path $cluster 'restore-server.log') -o "-h 127.0.0.1 -p $port" -w start
  if($LASTEXITCODE -ne 0){throw 'Temporary local restore database could not start.'}
  $started=$true
  $localDb="postgresql://octalve_webauthn_restore@127.0.0.1:$port/postgres?sslmode=disable"
  # The initdb default postgres database may already contain schema public.
  # --clean --if-exists removes conflicting objects ONLY in this disposable
  # loopback database, never in Neon Production.
  & $pgRestore --exit-on-error --clean --if-exists --no-owner --no-privileges --dbname="$localDb" "$archive"
  if($LASTEXITCODE -ne 0){throw 'Independent full-data restore failed; no Production schema changed.'}
  $query="SELECT (SELECT COUNT(*) FROM public.django_migrations), (SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public'), (to_regclass('public.accounts_privilegedpasskey') IS NOT NULL), (to_regclass('public.accounts_privilegedloginchallenge') IS NOT NULL), (to_regclass('public.accounts_privilegedpasskeygrant') IS NOT NULL)"
  $lines=@(& $psql -X -v ON_ERROR_STOP=1 --dbname="$localDb" --tuples-only --no-align --quiet -c "$query")
  if($LASTEXITCODE -ne 0 -or -not $lines){throw 'Restore validation query failed.'}
  if(($lines | Select-Object -Last 1).Trim() -cne '64|117|f|f|f'){throw 'Recovered database does not match the reviewed 64/117 snapshot.'}
  $restoredLedger=(& $psql -X -v ON_ERROR_STOP=1 --dbname="$localDb" --tuples-only --no-align --quiet -c "$ledgerQuery" | Select-Object -Last 1)
  if($LASTEXITCODE -ne 0 -or $restoredLedger -cne $beforeLedger){throw 'Restored migration ledger differs from Production.'}
  $again=(Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if($again -cne $sha){throw 'Archive mutated during the restore drill.'}
  Write-Host 'PASS: complete isolated restore, matching 64/117 Production ledger, same archive digest.'
  & $pgCtl -D "$cluster" -m immediate -w stop
  if($LASTEXITCODE -ne 0){throw 'Could not stop restored local database.'}
  $started=$false
  Remove-Item -LiteralPath "$cluster" -Recurse -Force
  if(Test-Path $cluster){throw 'Restore drill contains customer data; cleanup failed.'}
  $cluster=$null
  Write-Host "BACKUP SHA256: $sha"
  Write-Host "BASELINE LEDGER SHA256: $beforeLedger"
  if($BackupOnly){Write-Host 'BACKUP AND RESTORE QUALIFIED. No Production schema changes.';return}
  $env:OCTALVE_WEBAUTHN_LEDGER_SHA256=$beforeLedger
  $env:OCTALVE_WEBAUTHN_SOURCE_APPROVED='true'
  $env:OCTALVE_WEBAUTHN_BACKUP_VERIFIED='true';$env:OCTALVE_WEBAUTHN_RESTORE_VERIFIED='true'
  $env:OCTALVE_WEBAUTHN_BACKUP_FILE=$archive;$env:OCTALVE_WEBAUTHN_BACKUP_SHA256=$sha
  $env:OCTALVE_WEBAUTHN_RESTORE_SHA256=$again;$env:OCTALVE_WEBAUTHN_RESTORE_AT=[DateTimeOffset]::UtcNow.ToString('o')
  & $python backend/scripts/production_webauthn_preflight.py apply
  if($LASTEXITCODE -ne 0){throw 'Migration failed or was refused. Preserve backup; do not retry blindly.'}
  Write-Host 'SUCCESS: AUTH-02 Production migration applied and independently postflight-qualified.'
  Write-Host 'Both WebAuthn features stay disabled until separately activated.'
  Write-Host 'Keep the protected backup. Never upload it to GitHub or support chat.'
}
finally{
  if($passFile -and (Test-Path $passFile)){
    try{Remove-Item -LiteralPath $passFile -Force}
    catch{Write-Warning 'Temporary local authentication file cleanup failed.'}
  }
  if($started -and $pgCtl -and $cluster){
    & $pgCtl -D "$cluster" -m immediate -w stop | Out-Null
    if($LASTEXITCODE -ne 0){Write-Warning 'Restore server failed to stop. Investigate immediately.'}
    else{$started=$false}
  }
  if($cluster -and -not $started -and (Test-Path $cluster)){
    try{Remove-Item -LiteralPath "$cluster" -Recurse -Force}
    catch{Write-Warning 'Restore drill contains sensitive data; manually remove the private folder.'}
  }
  foreach($key in $keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}
  $dbUrl=$null
  Pop-Location
}
