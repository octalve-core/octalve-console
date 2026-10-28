# B2.8–B3 source-only recovery and release acceptance

This document is deliberately safe for a public source repository. Live infrastructure topology, provider credentials, environment secret inventories, security posture and failed operational change details belong in restricted operational records, not public Git history.

## Scope
- Read-only, bounded Review environment recovery command verifies the same exact authenticated provider connection IDs, audit heads and sequences across an encrypted vault snapshot and signed checkpoint.
- Requires independent snapshot and checkpoint keys, explicit review-enabled flags and manual command confirmation. Failed, incomplete, empty, mismatched or corrupt data is rejected.
- Output includes only non-secret counts and SHA-256 digests. Full Production disaster recovery, external WORM archival and live credential readiness are explicitly false in the generated evidence.
- Source-level release hold requires a separate default-off synthetic test guard and refuses all provider credential writes on deployed Vercel or non-DEBUG environments, even if legacy write flags are enabled. No live credential entry can be released in this source batch.
- Existing tests run only with synthetic keys and fixtures. All source and PostgreSQL CI checks must pass on the exact PR head before approval.

## Independent operational acceptance still required
1. B2.8: externally administered immutable/WORM object storage; independent append/read identities; version-pinned retention and SHA-256 verification; witnessed encrypted backup/restore including full PostgreSQL, hosting files, mail and control plane.
2. B2.9: actual KMS/HSM-managed key lifecycle, historical recovery, strong WebAuthn registration/assertion verified by trusted backend and independent multi-party account recovery.
3. B2.10: independently controlled worker with deny-default network egress, verified DNS/public IP and TLS certificate ownership, network-level negative controls and supplier API limits.
4. B3: individually approved least-privilege DirectAdmin/WHM read-only credentials and live noncustomer test-account verification, followed by separately approved provisioning authority.
5. Release: protected Production branch policy, safe connectivity/egress review, independent security sign-off and explicit controlled deployment plan. Neither source CI nor a local mock test certifies infrastructure.

## Explicit hold
No Production database migration or configuration, no AWS/VPS resource creation, no real supplier credential, no customer provisioning and no Production Vercel deploy are authorized by this PR. Do not merge to a Git branch tracked by automatic Production deployment without a separate approved release-control change.

References: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html ; https://www.w3.org/TR/webauthn-3/ ; https://neon.com/docs/manage/branches ; https://vercel.com/docs/git
