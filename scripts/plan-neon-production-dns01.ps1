# Octalve Cloud DNS-01: reviewed local Neon Production migration.
# Windows PowerShell 5.1 or PowerShell 7, clean octalve-core/octalve-console main.
# powershell -ExecutionPolicy Bypass -File .\scripts\plan-neon-production-dns01.ps1 -Preflight
# powershell -ExecutionPolicy Bypass -File .\scripts\plan-neon-production-dns01.ps1 -Apply
# Apply repeats preflight, makes fresh pg_dump, restores entire data archive to
# disposable loopback-only PostgreSQL, then requests typed schema approval.
[CmdletBinding()]
param([switch]$Preflight,[switch]$Apply,[switch]$PlanOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$selected=[int][bool]$Preflight+[int][bool]$Apply+[int][bool]$PlanOnly
if($selected -ne 1){throw 'Choose exactly -Preflight, -PlanOnly or -Apply.'}
if($env:CI -or $env:GITHUB_ACTIONS -or $env:VERCEL){throw 'Trusted local Windows operator only; CI and Vercel prohibited.'}
$root=(& git rev-parse --show-toplevel 2>$null)
if($LASTEXITCODE -ne 0 -or -not $root){throw 'Open your octalve-core/octalve-console Git checkout.'}
Push-Location $root.Trim()
$keys=@('DATABASE_URL','DJANGO_SECRET_KEY','OCTALVE_CLOUD_ENV','DEBUG','ALLOWED_HOSTS',
 'OCTALVE_DNS01_SOURCE_APPROVED','OCTALVE_DNS01_BACKUP_VERIFIED','OCTALVE_DNS01_RESTORE_VERIFIED',
 'OCTALVE_DNS01_BACKUP_FILE','OCTALVE_DNS01_BACKUP_SHA256','OCTALVE_DNS01_RESTORE_SHA256',
 'OCTALVE_DNS01_RESTORE_AT','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE')
$previous=@{}
foreach($key in $keys){$previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$pgCtl=$null;$cluster=$null;$started=$false;$dbUrl=$null;$passFile=$null
try{
  if((& git branch --show-current).Trim() -cne 'main'){throw 'Only reviewed main may migrate Production.'}
  if(@(& git status --porcelain).Count -ne 0){throw 'Git working tree is not clean.'}
  $origin=(& git remote get-url origin).Trim()
  if($LASTEXITCODE -ne 0 -or $origin -notmatch '^(https://github[.]com/|git@github[.]com:)octalve-core/octalve-console([.]git)?/?$'){
    throw 'Wrong repository origin. Refusing Production migration.'
  }
  & git fetch --quiet origin main
  if($LASTEXITCODE -ne 0){throw 'Could not fetch GitHub main.'}
  if((& git rev-parse HEAD).Trim() -cne (& git rev-parse origin/main).Trim()){
    throw 'Local main differs from GitHub main. Run git pull --ff-only first.'
  }
  if(-not (Test-Path 'backend/domains/migrations/0002_dns_readonly_binding.py')){throw 'DNS-01 migration is missing.'}
  if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'Windows LOCALAPPDATA missing.'}
  $venv=Join-Path $env:LOCALAPPDATA 'OctalveCloud\DNS01ReleasePython312'
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
  $env:DJANGO_SECRET_KEY='dns01-migration-only-'+[guid]::NewGuid().ToString('N')
  $env:OCTALVE_CLOUD_ENV='production';$env:DEBUG='false';$env:ALLOWED_HOSTS='localhost,127.0.0.1'
  & $python backend/scripts/production_dns01_preflight.py plan
  if($LASTEXITCODE -ne 0){throw 'Neon Production preflight refused.'}
  Push-Location backend
  try{
    & $python manage.py check
    if($LASTEXITCODE -ne 0){throw 'Django check failed.'}
    & $python manage.py makemigrations --check --dry-run
    if($LASTEXITCODE -ne 0){throw 'Unexpected uncommitted migration change.'}
  } finally {Pop-Location}
  Write-Host 'PREFLIGHT PASSED: exact Production database, original ledger and one reviewed DNS-01 migration.'
  if(-not $Apply){Write-Host 'No database changes were made.';return}

  $candidates=@()
  $found=Get-Command pg_dump.exe -ErrorAction SilentlyContinue
  if($found){$candidates+=(Split-Path -Parent $found.Source)}
  $pgHome=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'PostgreSQL'
  if(Test-Path $pgHome){
    $candidates+=@(Get-ChildItem $pgHome -Directory | Sort-Object Name -Descending | ForEach-Object {Join-Path $_.FullName 'bin'})
  }
  $pgBin=$null
  foreach($dir in $candidates){
    $missing=@(@('pg_dump.exe','pg_restore.exe','psql.exe','initdb.exe','pg_ctl.exe','postgres.exe') | Where-Object {-not (Test-Path (Join-Path $dir $_))})
    if($missing.Count -eq 0){$pgBin=$dir;break}
  }
  if(-not $pgBin){throw 'Install PostgreSQL tools including pg_dump, pg_restore, initdb, pg_ctl, postgres and psql.'}
  $pgDump=Join-Path $pgBin 'pg_dump.exe';$pgRestore=Join-Path $pgBin 'pg_restore.exe'
  $pgInit=Join-Path $pgBin 'initdb.exe';$pgCtl=Join-Path $pgBin 'pg_ctl.exe';$psql=Join-Path $pgBin 'psql.exe'
  $dbUri=[Uri]$dbUrl;$parts=$dbUri.UserInfo.Split(':',2)
  if($parts.Count -ne 2){throw 'Invalid database user format.'}
  $env:PGUSER=[Uri]::UnescapeDataString($parts[0]);$env:PGPASSWORD=[Uri]::UnescapeDataString($parts[1])
  $env:PGHOST=$dbUri.Host;$env:PGPORT='5432';$env:PGDATABASE='neondb';$env:PGSSLMODE='require'
  $folder=Join-Path $env:LOCALAPPDATA 'OctalveCloud\ProtectedDatabaseBackups'
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $archive=Join-Path $folder ('pre-dns01-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')
  if(Test-Path $archive){throw 'Backup archive collision; never overwrite.'}
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
  & $pgInit -D "$cluster" -U octalve_dns01_restore -A scram-sha-256 --pwfile="$passFile" --encoding=UTF8 --no-instructions
  if(Test-Path $passFile){Remove-Item -LiteralPath $passFile -Force}
  $passFile=$null
  if($LASTEXITCODE -ne 0){throw 'Temporary restore database initialization failed.'}
  $env:PGPASSWORD=$localPassword
  $localPassword=$null
  & $pgCtl -D "$cluster" -o "-h 127.0.0.1 -p $port" -w start
  if($LASTEXITCODE -ne 0){throw 'Temporary local restore database could not start.'}
  $started=$true
  $localDb="postgresql://octalve_dns01_restore@127.0.0.1:$port/postgres?sslmode=disable"
  & $pgRestore --exit-on-error --no-owner --no-privileges --dbname="$localDb" "$archive"
  if($LASTEXITCODE -ne 0){throw 'Independent full-data restore failed; no Production schema changed.'}
  $query="SELECT (SELECT COUNT(*) FROM public.django_migrations), (SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public'), (to_regclass('public.domains_domaindnsbinding') IS NOT NULL)"
  $lines=@(& $psql --dbname="$localDb" --tuples-only --no-align --quiet -c "$query")
  if($LASTEXITCODE -ne 0 -or -not $lines){throw 'Restore validation query failed.'}
  if(($lines | Select-Object -Last 1).Trim() -cne '62|115|f'){throw 'Recovered database does not match the reviewed 62/115 snapshot.'}
  $again=(Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if($again -cne $sha){throw 'Archive mutated during the restore drill.'}
  Write-Host 'PASS: complete isolated restore, matching Production ledger, same archive digest.'
  & $pgCtl -D "$cluster" -m immediate -w stop
  if($LASTEXITCODE -ne 0){throw 'Could not stop restored local database.'}
  $started=$false
  Remove-Item -LiteralPath "$cluster" -Recurse -Force
  if(Test-Path $cluster){throw 'Restore drill contains customer data; cleanup failed.'}
  $cluster=$null
  $env:OCTALVE_DNS01_SOURCE_APPROVED='true'
  $env:OCTALVE_DNS01_BACKUP_VERIFIED='true';$env:OCTALVE_DNS01_RESTORE_VERIFIED='true'
  $env:OCTALVE_DNS01_BACKUP_FILE=$archive;$env:OCTALVE_DNS01_BACKUP_SHA256=$sha
  $env:OCTALVE_DNS01_RESTORE_SHA256=$again;$env:OCTALVE_DNS01_RESTORE_AT=[DateTimeOffset]::UtcNow.ToString('o')
  & $python backend/scripts/production_dns01_preflight.py apply
  if($LASTEXITCODE -ne 0){throw 'Migration failed or was refused. Preserve backup; do not retry blindly.'}
  Write-Host 'SUCCESS: DNS-01 Production migration applied and independently postflight-qualified.'
  Write-Host 'Read-only DNS feature stays disabled until explicitly activated.'
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
