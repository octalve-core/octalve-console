# Octalve Cloud — local Vercel monorepo link qualification.
# Read-only. No CLI calls, credentials, deployments, aliases or Git changes.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\verify-cloud-vercel-links.ps1
[CmdletBinding()]
param(
  [string]$RootPath = "",
  [ValidateSet("Both", "Backend", "Frontend")]
  [string]$Target = "Both"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$expectedOrgId = "team_048l7k9uaP1YfuEx5KaxO3dh"
$expected = @(
  @{ Directory = "backend";  Name = "octalve-cloud-api"; Id = "prj_iFSbPGawzM1peDZDYw8AnDCYBvbz" },
  @{ Directory = "frontend"; Name = "octalve-console";   Id = "prj_CqAeZgrQPFXrNFFZTMnMkUhijQua" }
)

if ([string]::IsNullOrWhiteSpace($RootPath)) {
  $RootPath = Join-Path (Split-Path -Parent $PSScriptRoot) "."
}
$root = (Resolve-Path -LiteralPath $RootPath).Path
$repoPath = Join-Path $root ".vercel/repo.json"
$projectPath = Join-Path $root ".vercel/project.json"

if (-not (Test-Path -LiteralPath $repoPath -PathType Leaf)) {
  throw "Vercel monorepo mapping is missing. Run 'pnpm dlx vercel@66.6.0 link --repo --scope octalve-vault' from the existing repository root."
}
try {
  $config = Get-Content -LiteralPath $repoPath -Raw | ConvertFrom-Json
} catch {
  throw "Vercel monorepo mapping is invalid JSON. No deployment is permitted."
}
if ($null -eq $config -or $null -eq $config.projects) {
  throw "Vercel monorepo mapping has no projects array. No deployment is permitted."
}
$projects = @($config.projects)
if ($projects.Count -ne 2) {
  throw "Expected exactly two existing Cloud Vercel projects, found $($projects.Count). Do not deploy."
}
$rootLink = $null
if (Test-Path -LiteralPath $projectPath -PathType Leaf) {
  try { $rootLink = Get-Content -LiteralPath $projectPath -Raw | ConvertFrom-Json }
  catch { throw "Repository root Vercel project link is invalid. Do not deploy." }
}
# Some Vercel CLI versions put the organization ID in project.json instead
# of repo.json. The known org, when present in either file, must match.
$orgIds = @()
if ($config.PSObject.Properties.Match("orgId").Count -gt 0 -and $config.orgId) {
  $orgIds += [string]$config.orgId
}
if ($null -ne $rootLink -and
    $rootLink.PSObject.Properties.Match("orgId").Count -gt 0 -and $rootLink.orgId) {
  $orgIds += [string]$rootLink.orgId
}
if ($orgIds.Count -eq 0 -or @($orgIds | Where-Object { $_ -cne $expectedOrgId }).Count -gt 0) {
  throw "Vercel organization does not match the existing Octalve Vault team. Do not deploy."
}
if ($null -ne $rootLink -and
    $rootLink.PSObject.Properties.Match("projectId").Count -gt 0 -and $rootLink.projectId -and
    @($expected | Where-Object { $_.Id -ceq [string]$rootLink.projectId }).Count -ne 1) {
  throw "Repository root project link names an unknown Vercel project. Do not deploy."
}
function Normalize-CloudDirectory([object]$value) {
  if ($null -eq $value -or $value -isnot [string]) { return "" }
  $directory = $value.Trim().Replace('\', '/')
  while ($directory.StartsWith("./", [StringComparison]::Ordinal)) {
    $directory = $directory.Substring(2)
  }
  return $directory.TrimEnd('/')
}
foreach ($item in $expected) {
  $entries = @($projects | Where-Object {
    (Normalize-CloudDirectory $_.directory) -ceq $item.Directory
  })
  if ($entries.Count -ne 1) {
    throw "Missing or duplicated Vercel mapping for '$($item.Directory)'. Do not deploy."
  }
  $mapped = $entries[0]
  if ([string]$mapped.id -cne $item.Id -or [string]$mapped.name -cne $item.Name) {
    throw "Wrong Vercel project mapped to '$($item.Directory)'. Do not deploy."
  }
  if ($Target -eq "Both" -or $Target.ToLowerInvariant() -eq $item.Directory) {
    Write-Output "VERIFIED: $($item.Directory) -> $($item.Name) [$($item.Id)]"
  }
}
Write-Output "PASS: existing Octalve Cloud Vercel monorepo project links are correctly separated. No deployment performed."
