# INT-02 Windows production recovery gate — 2026-11-01

The operator confirmed a clean Django preflight: `check` and `makemigrations --check --dry-run` pass, with only provider migrations 0002, 0003 and 0004 pending. Neon project `falling-surf-50258433` is labelled `octalve-cloud-review-db`; its default branch is `br-dark-bread-b8j0gqz4` and direct endpoint is `ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech`. Neon displays an association to the Vercel production project `octalve-cloud-api`; the sensitive Vercel Production database URL still requires an operator comparison.

On the operator Windows computer, C: is fully decrypted, while an encrypted VeraCrypt container is mounted as X:. PostgreSQL client 18.3 and Python 3.12.10 are available. The earlier recovery script failed at certificate verification and did not make a backup or apply a migration. Do not downgrade TLS to bypass this.

The revised Windows recovery rehearsal should use PostgreSQL `verify-full` plus a trusted CA bundle from the pinned Python `certifi` installation, enforce read-only connections to the source, take `pg_dump -Fc` directly to the VeraCrypt volume, and separately restore to a disposable PostgreSQL 18 cluster whose data directory is also on the VeraCrypt volume. Test the pending migrations on that recovered copy and confirm the provider append-only trigger is enabled. Copy the dismounted encrypted VeraCrypt container to separately controlled off-device storage, with recovery keys held separately, before applying any Production migration.

Stop if connection identity, backup, restore, migration rehearsal, audit trigger or offsite encrypted custody is unverified. All credential-write flags remain disabled. The owner account already has admin/staff/superuser flags, but email ownership verification is outstanding. PR #111 has successful CI but remains unmerged. Never promote the account again or mark the email verified without the verified workflow.

Guidance: https://www.postgresql.org/docs/18/libpq-ssl.html and https://www.postgresql.org/docs/18/app-pgdump.html.


## Post-migration identity and mail readiness — not an automatic release

The owner account's role flags are already correct, but its `email_verified_at` is NULL. The production account-email switch `CLOUD_ACCOUNT_EMAIL_ENABLED` is disabled, and no approved SMTP host, username, password or sender address is configured for `octalve-cloud-api`. Do not manually set the timestamp. The authenticated account email-verification request endpoint is `POST /api/auth/email/verification/request/`; successful delivery requires a verified sending domain and approved transactional SMTP relay with authenticated STARTTLS or SSL. The one-use confirmation link targets `https://console.cloud.octalve.com/verify-email#token=...` and is confirmed through `POST /api/auth/email/verification/confirm/`.

The source now requires `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, non-local `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, and exactly one of `EMAIL_USE_TLS` or `EMAIL_USE_SSL` before the account email gate can report ready. Set `CLOUD_ACCOUNT_EMAIL_ENABLED=true` only after independently proving the sender-domain ownership, SPF/DKIM/DMARC policy, delivery, non-enumeration and secret redaction. Vercel credentials remain sensitive, never checked into Git or inserted into the connected provider vault while its own custody gate is pending.

No Production SMTP credentials or provider-vault writes were enabled by the schema migration.
