[CmdletBinding(SupportsShouldProcess)]
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$repo = 'octalve-core/octalve-console'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'branch-cleanup-2026-11-28.json') -Raw | ConvertFrom-Json
if ($manifest.repository -ne $repo) { throw 'Unexpected manifest repository.' }
$remote = (git remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)octalve-core/octalve-console(\.git)?/?$') {
    throw 'Origin is not the approved Octalve Console repository.'
}
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI must be authenticated.' }
$default = gh api "repos/$repo" --jq '.default_branch'
if ($LASTEXITCODE -ne 0 -or $default -ne 'main') { throw 'Default branch could not be verified.' }
git fetch --prune origin
if ($LASTEXITCODE -ne 0) { throw 'Cannot refresh remote refs.' }
git merge-base --is-ancestor $manifest.main_sha refs/remotes/origin/main
if ($LASTEXITCODE -ne 0) { throw 'Current main does not contain audited baseline.' }

$deleted = 0; $eligible = 0; $skipped = 0
$never = @('main','review/cloud','codex/hosting-transactional-delivery')
foreach ($entry in @($manifest.branches | Where-Object decision -eq 'delete_candidate')) {
    $name = [string]$entry.branch
    if ($never -contains $name -or $name -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]+$' -or $entry.sha -notmatch '^[0-9a-f]{40}$') {
        throw "Invalid or protected manifest entry: $name"
    }
    $ref = "refs/heads/$name"
    $tip = git ls-remote --heads origin $ref
    if ($LASTEXITCODE -ne 0) { throw "Cannot check remote branch: $name" }
    if (-not $tip) { Write-Host "ABSENT $name"; $skipped++; continue }
    if (($tip -split '\s+')[0] -ne $entry.sha) { Write-Warning "CHANGED $name"; $skipped++; continue }

    $encoded = [Uri]::EscapeDataString($name)
    $branchJson = gh api "repos/$repo/branches/$encoded"
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect branch protection: $name" }
    $branchInfo = $branchJson | ConvertFrom-Json
    if ($branchInfo.protected -ne $false -or $branchInfo.commit.sha -ne $entry.sha) { Write-Warning "PROTECTED OR CHANGED $name"; $skipped++; continue }

    # Recheck open PRs, including stacked PRs targeting this branch.
    $openRefs = gh api --paginate "repos/$repo/pulls?state=open&per_page=100" --jq '.[] | .head.ref, .base.ref'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify current open pull requests.' }
    if (@($openRefs) -contains $name) { Write-Warning "OPEN PR $name"; $skipped++; continue }

    if ($null -ne $entry.pr) {
        $prJson = gh api "repos/$repo/pulls/$($entry.pr)"
        if ($LASTEXITCODE -ne 0) { throw "Cannot verify merged PR: $($entry.pr)" }
        $pr = $prJson | ConvertFrom-Json
        if ($pr.merged -ne $true -or $pr.head.ref -ne $name -or $pr.head.sha -ne $entry.sha -or $pr.merge_commit_sha -ne $entry.merge_sha) {
            Write-Warning "MERGE EVIDENCE CHANGED $name"; $skipped++; continue
        }
        $proof = [string]$entry.merge_sha
    } else { $proof = [string]$entry.sha }
    git merge-base --is-ancestor $proof refs/remotes/origin/main
    if ($LASTEXITCODE -ne 0) { Write-Warning "NOT IN MAIN $name"; $skipped++; continue }

    $eligible++
    if (-not $Apply) { Write-Host "ELIGIBLE $name ($($entry.sha))"; continue }
    if ($PSCmdlet.ShouldProcess("$repo/$name", 'Delete verified redundant remote branch')) {
        # Exact lease protects against a concurrently changed branch tip.
        git push "--force-with-lease=$($ref):$($entry.sha)" origin ":$ref"
        if ($LASTEXITCODE -ne 0) { throw "Deletion failed; stop and re-audit: $name" }
        $remaining = git ls-remote --heads origin $ref
        if ($LASTEXITCODE -ne 0 -or $remaining) { throw "Deletion not independently confirmed: $name" }
        $deleted++
        Write-Host "DELETED $name"
    }
}
Write-Host "Eligible: $eligible | Deleted: $deleted | Absent or held: $skipped"
if (-not $Apply) { Write-Host 'DRY RUN ONLY. Review evidence before adding -Apply.' }
