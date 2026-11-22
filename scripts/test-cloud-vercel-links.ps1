# CI-only tests for the local read-only Vercel project-link verifier.
# No Vercel connection, token, deployment or real project file is accessed.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "verify-cloud-vercel-links.ps1"
$fixture = Join-Path ([IO.Path]::GetTempPath()) ("octalve-vercel-link-" + [guid]::NewGuid().ToString("N"))
$vercel = Join-Path $fixture ".vercel"
$repoFile = Join-Path $vercel "repo.json"
$projectFile = Join-Path $vercel "project.json"
$team = "team_048l7k9uaP1YfuEx5KaxO3dh"
$api = "prj_iFSbPGawzM1peDZDYw8AnDCYBvbz"
$console = "prj_CqAeZgrQPFXrNFFZTMnMkUhijQua"
$passed = 0

function New-ValidFixture {
  $body = @{
    orgId = $team
    projects = @(
      @{ directory = "backend";  name = "octalve-cloud-api"; id = $api },
      @{ directory = "frontend"; name = "octalve-console"; id = $console }
    )
  }
  Set-Content -LiteralPath $repoFile -Value ($body | ConvertTo-Json -Depth 8) -Encoding UTF8
  $rootLink = @{ orgId = $team; projectId = $console }
  Set-Content -LiteralPath $projectFile -Value ($rootLink | ConvertTo-Json -Depth 4) -Encoding UTF8
}
function Get-RepoFixture {
  return (Get-Content -LiteralPath $repoFile -Raw | ConvertFrom-Json)
}
function Save-RepoFixture([object]$value) {
  Set-Content -LiteralPath $repoFile -Value ($value | ConvertTo-Json -Depth 8) -Encoding UTF8
}
function Assert-Accepts([string]$description) {
  $result = @(& $scriptPath -RootPath $fixture)
  if ($result.Count -lt 3 -or
      -not ($result -match "VERIFIED: backend -> octalve-cloud-api") -or
      -not ($result -match "VERIFIED: frontend -> octalve-console") -or
      -not ($result -match "PASS: existing Octalve Cloud")) {
    throw "Expected verified pair: $description"
  }
  $script:passed++
}
function Assert-Refuses([string]$description) {
  $failed = $false
  try { $null = & $scriptPath -RootPath $fixture }
  catch { $failed = $true }
  if (-not $failed) { throw "Verifier accepted an unsafe release mapping: $description" }
  $script:passed++
}

New-Item -ItemType Directory -Path $vercel -Force | Out-Null
try {
  New-ValidFixture
  Assert-Accepts "correct API + Console mapping"

  New-ValidFixture
  $data = Get-RepoFixture
  $data.projects[1].id = $api
  Save-RepoFixture $data
  Assert-Refuses "frontend incorrectly mapped to the API project"

  New-ValidFixture
  $data = Get-RepoFixture
  $data.projects = @($data.projects[0])
  Save-RepoFixture $data
  Assert-Refuses "Console project missing"

  New-ValidFixture
  $data = Get-RepoFixture
  $data.projects[1].directory = "backend"
  Save-RepoFixture $data
  Assert-Refuses "duplicate backend directory"

  New-ValidFixture
  $data = Get-RepoFixture
  $data.projects[1].id = "prj_UNTRUSTED"
  Save-RepoFixture $data
  Assert-Refuses "unknown frontend project ID"

  New-ValidFixture
  $data = Get-RepoFixture
  $data.orgId = "team_UNTRUSTED"
  Save-RepoFixture $data
  Assert-Refuses "wrong Vercel team"

  New-ValidFixture
  Set-Content -LiteralPath $projectFile -Value '{"orgId":"team_UNTRUSTED","projectId":"prj_CqAeZgrQPFXrNFFZTMnMkUhijQua"}'
  Assert-Refuses "repository-level team mismatch"

  New-ValidFixture
  Remove-Item -LiteralPath $repoFile
  Assert-Refuses "monorepo link missing"

  New-ValidFixture
  $data = Get-RepoFixture
  $data.projects[0].directory = "../backend"
  Save-RepoFixture $data
  Assert-Refuses "unexpected relative parent directory"

  New-ValidFixture
  Remove-Item -LiteralPath $projectFile
  Assert-Accepts "valid repo-level mapping with orgId, no legacy root project link"
} finally {
  Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "PASS: $passed Vercel mapping acceptance/refusal tests (no deployment)."
