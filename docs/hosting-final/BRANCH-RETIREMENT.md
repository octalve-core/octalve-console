# GitHub branch retirement — safe execution

Audit: 28 November 2026. Manifest: [branch-cleanup-2026-11-28.json](branch-cleanup-2026-11-28.json). It contains all 133 branches existing before this documentation branch: 127 eligible, six retained. No deletion occurred during the audit. This is GitHub only, not Neon.

The GitHub connector does not expose a ref-delete operation. Execute from the user's authenticated local clone using the provided script. It is dry-run by default. The script rechecks the exact remote ref, current main ancestry (merge commit for squash merges), merged PR metadata and current open PRs, protection and default branch. It uses a lease on each exact branch tip; a changed or unavailable branch is skipped. It never deletes main, review/cloud, the open PR #180 branch, or unique/divergent work.

From PowerShell at the repository root:
```powershell
git switch main
git pull --ff-only origin main
gh auth status
powershell -NoProfile -File .\docs\hosting-final\Retire-AuditedBranches.ps1
# Inspect dry-run; only then explicitly apply:
powershell -NoProfile -File .\docs\hosting-final\Retire-AuditedBranches.ps1 -Apply
git fetch --prune origin
git branch -r
```

GitHub CLI and Git must already be authenticated to the correct repository. If unavailable, use the repository's Branches page (https://github.com/octalve-core/octalve-console/branches), checking the manifest before deleting. Do not use age, naming convention or Git's merged-only list alone as proof: squash and stacked merges require PR evidence. Do not automatically delete closed-unmerged or protected branches.

Enable "Automatically delete head branches" in repository Settings > General > Pull Requests for future merged feature branches (subject to protection rules); it was disabled at audit time. Review long-lived/release branches before any future policy change. The new documentation PR branch is not in the dated manifest; after merge, retire it separately using the same proof and lease.

Retain three operational branches: main, review/cloud, and codex/hosting-transactional-delivery (#180). Retain three divergent branches pending individual diff/reconciliation: codex/hosting-vendor-execution (2 commits), codex/launch-03-automation-core (#172 closed unmerged; 35 commits), docs/full-cloud-audit-cleanup-20261030 (9 commits). A clean-looking branch list does not justify losing unique work.
