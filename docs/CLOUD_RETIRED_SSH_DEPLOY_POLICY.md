# Retired VPS SSH deployment
The original `.github/workflows/deploy.yml` contained an SSH/rsync pipeline
for a server that is no longer active. It was initially changed to manual-only
during Cloud C1, but should not ship in the active GitHub Actions list because
it can be triggered with stale secrets.

Vercel Git integration builds Preview from review branches and Production from
the designated production branch. Once Octalve migrates to its own
infrastructure, implement an entirely new audited deployment workflow using
short-lived credentials, host-key pinning, protected environments, backup,
rollback and approval. Do not reactivate the previous workflow.

This change removes **the obsolete workflow only**, not hosting application
source and not any live Vercel deployment.
