# INT-02 Production continuation — 2026-11-01 (evidence and blocked gates)

## Scope
Source verification and risk-reduction only. Do not treat READY Vercel deployments, a Super Admin flag, or green synthetic tests as a live provider connection. Do not turn on supplier writes, domain purchases, email sending, or provisioning. Keep Production credential-submission and provider-execution flags disabled until all gates below are independently evidenced.

## Read-only evidence observed on 1 November
- Console GitHub main SHA: `9c5ad9b1f8990fac89a46bf02af116fceb97da99` (INT-02 PR #110); Vercel API Production deployment at this SHA reported READY.
- Neon project `falling-surf-50258433`, database `neondb`, primary branch `br-dark-bread-b8j0gqz4`, database role `neondb_owner`. Project's name still contains `review-db`; **do not infer identity from its label**. Match the locally supplied Production API `DATABASE_URL` host and database to the Neon primary endpoint from the operator's authorized Vercel/Neon dashboard before any write.
- Existing intended owner `octalve0@gmail.com` has ID `3`, `role=admin`, `is_staff=true`, `is_superuser=true`, `is_active=true`, and a usable-looking password hash. **Its `email_verified_at` is NULL**. No owner promotion is needed in this inspected branch; do not set verification timestamps by assumption or through an unaudited SQL shortcut. Re-verify account identity and use the certified account-email verification workflow.
- `django_migrations` contains only `providers.0001_initial`; `0002_integration_draft_vault`, `0003_provider_vault_authenticator`, `0004_provider_event_integrity` are not applied. Expected vault tables and append-only event trigger are missing. Production vault credential writes must remain OFF.
- Neon branch quota (10) and snapshot quota are exhausted. The explicitly authorized delete target `br-wild-field-b88w1xq5` cannot be deleted because `br-odd-hat-b871exkh` is its child. The attempt failed safely, with no deletion. Creating a fresh snapshot also returned `snapshots limit exceeded`. **Do not delete the child or any other branch to force a backup.**
- Vercel Production lists `DATABASE_URL` and `DJANGO_SECRET_KEY`, but project credentials are protected, so this audit has not independently proved that the running API points to the inspected Neon branch. The production vault bootstrap key and approval switches were not listed. No live provider has been authenticated.

## Approved safest next workflow — trusted local Windows operator

1. Pull latest **reviewed** `main` and ensure a clean worktree:
   ```powershell
   git fetch origin main
   git checkout main
   git pull --ff-only origin main
   git status --short
   git rev-parse HEAD
   ```
2. Read `docs/INT02_PORTABLE_CONSOLE_VAULT_AND_OWNER_APPROVAL_2026-11-01.md`. Confirm exact backend SHA and current migration filenames. Use a Windows Python 3.12 virtual environment with repository-pinned requirements. Obtain the Production direct PostgreSQL URL in an approved local secret-input mechanism; never paste it into chat, GitHub, source, shell history or logs. No `NEXT_PUBLIC_*` keys.
3. Verify connected database host, project, branch and read/write endpoint against the operator's own Production Vercel API configuration and the Neon primary branch. Require TLS, `neondb`, `neondb_owner`, expected schema, expected owner and exact source SHA. **Stop** on mismatch. Never execute a migration on a branch merely because it is named `main`.
4. Preview migration plan and check source consistency while connected to that verified database:
   ```powershell
   cd backend
   python manage.py check --deploy
   python manage.py makemigrations --check --dry-run
   python manage.py showmigrations providers
   python manage.py migrate providers 0004 --plan
   ```
   Expected new operations must be limited to `providers.0002`, `providers.0003`, `providers.0004` and verified dependencies. No migration must be silently marked `--fake`.
5. Obtain a **fresh complete PostgreSQL custom-format backup** using `pg_dump -Fc` and TLS before any migration. Protect it immediately with authenticated encryption and separate off-host custody; record its SHA-256 fingerprint, archive table of contents and independently restore to a disposable isolated PostgreSQL environment using `pg_restore`. Check the restored schema, migrations and expected account count. Do not proceed if backup encryption, integrity or restore drill cannot be verified. This external backup substitutes for the unavailable Neon snapshot, but it is not evidence of an offsite recovery unless copies/keys are independently retained.
6. Only after the exact Production identity, migration plan, encrypted backup + restore proof and owner change window are documented, execute `python manage.py migrate providers 0004 --noinput` from the controlled operator shell. Record the Django migration result; recheck ledger and the `providers_event_append_only` trigger enabled state, `providers_block_event_rewrite` function and newly created tables. Leave Production vault flags OFF if the checks fail.
7. Confirm existing owner access and genuine email ownership; never grant email verification by changing a DB field without independently validated evidence. Reauthenticate after any security-account change.
8. Qualify independent active keys `CLOUD_PROVIDER_VAULT_KEY`, `CLOUD_PROVIDER_STEPUP_KEY`, `CLOUD_PROVIDER_AUDIT_KEY`, distinct from the Django root secret, in approved Octalve-controlled custody. Demonstrate key recovery and least-privilege external access. Only then authorize step-up enrollment and, separately, credential writes. Vendor keys are entered **through Console**; the small vault bootstrap keyset remains in KMS/secrets infrastructure, not in the same PostgreSQL database.
9. Complete denied-role, unverified-email, invalid-password, TOTP replay, disabled-trigger, missing-key, no-browser-storage and no-secret-response tests before a single read-only Cloudflare/Brevo authenticated proof. Record separate non-secret vendor IDs/timestamps. Read-only proof is not supplier activation.

## Security patch in this continuation branch
Provider-vault step-up now requires `email_verified_at` along with active `role=admin` / `is_staff` / `is_superuser`. The provider connection list/detail/schema endpoints also require the same stricter authority. Migration-qualified audit-trigger inspection additionally requires the trigger to be enabled. Regression tests cover the verified and unverified owner states. This source change requires CI and review before `main` merge; it is not an instruction to bypass the owner account's missing verification.

## No-go boundaries
No Production schema write occurred in the 1 November inspection. No fresh backup was successfully created by the Neon service owing to quota; do not claim otherwise. No migration, Super Admin change, registered domain, provider credential entry, DNS mutation, sale or deployment has been performed by this continuation. The action to resume is **verified Production URL + fresh encrypted external backup and restore**, then approved provider migration.
