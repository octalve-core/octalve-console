# Octalve Cloud — Batch 2 Settings qualification and production release gate (2026-10-30)

## Scope and observed evidence
This document extends `CONSOLE_BATCH_1_2_ACCEPTANCE_2026-10-30.md` and records **implemented** vs **not yet certified**, with exact source authorities. Prior to this branch, 14 Settings routes mostly displayed field labels and developer copy with no connection to underlying Django values. Do not describe visually disabled fake inputs as working integration.

| Section | Actual route | Backend owner | Current status / restrictions |
|---|---|---|---|
| General | `/admin/settings/general` | `GET/PATCH /api/settings/console-policy/general/` | Validated name, support email, timezone, default language policy persists with revision and audit. Language activation waits multilingual gate. |
| Theme | `/admin/settings/theme` | Console policy + `GET /api/settings/console-theme/` | Allowlisted primary/canvas/density saved. Responsive preview and public tokens applied to shared Console Tailwind tokens. |
| Invoices | `/admin/settings/invoices` | Console policy + `billing.Invoice.create_from_order/create_renewal_invoice` | Saved prefix/approved template, footer snapshot for *new* invoices; sequence lock still owns numbering. Reminder policy saved only, schedule remains blocked. |
| Mail | `/admin/settings/mail` | Console policy + `/api/settings/console-mail/*` | Sender display policy saved, templates editable/versioned; sender execution NOT CERTIFIED. |
| Notifications | `/admin/settings/notifications` | `console-mail/templates/` and `console-mail/outbox/` | Create, edit, duplicate, activate, syntactically safe preview, durable queued state. No customer-facing sends without provider certification. |
| Tax | `/admin/settings/tax` | `GET/PATCH /api/settings/console-tax/` | Validated, auditable `TaxSettings` persisted. Checkout and invoice tax calculation are **not enabled**; no visible promise they are. |
| Security, Social login, API keys, Providers, Credits, Cron, Tickets, Other | respective Admin Settings routes | `GET /api/settings/console-status/<section>/` | Server-returned qualification statuses and real operational links, **no fake configuration or credential collection**. |
| Integration Store | `/admin/integrations` | Provider vault and adapters | Supplier credentials, verification and rotation belong here; never duplicate in Settings. |
| Catalogue and Provisioning | existing authority | catalogue/worker | No provider or purchase state changes in Settings. |

## Security and correctness
- `SuperAdminSettings` requires authenticated, active, staff, superuser, role `admin`. Anonymous/client/staff cannot read/write private Console settings. A presentation guard never authorizes Django mutation.
- Exact allowlist; strong type/length constraints; row locks and optimistic revision; audit ID receipts without old/new secret or PII values.
- Template personalization is bounded `{{customer.first_name}}` style only, HTML escapes text, rejects unrecognized variables and CR/LF subjects; no arbitrary HTML, JS, SQL or template engine evaluation.
- Versioned snapshots are separate from live email delivery. Outbox idempotency is unique and marketing enqueue requires documented consent. No provider is marked accepted or sent without independently verified receipt.
- Public theme emits only validated safe colours; no secret API credentials appear in Settings responses.
- Issue-time invoice policy frozen to invoice metadata; past invoice totals and visual templates remain pinned. `tax_total` remains controlled by existing checkout; saved TaxSettings **does not** change it automatically.
- No unreviewed OAuth, SMTP, API key issuance, sender failover, bulk mail, cron runner, wallet funding or automatic credits. These depend on verified BFF and provider integration security controls.
- Legacy EmailProviderAdapter formerly returned `ok=True` without executing a network call; changed to explicit failure to prevent fake health.

## Outstanding certifications (must not claim feature completed)
1. Real Google/Apple/Facebook OIDC/OAuth provider contracts with PKCE, state, nonce, issuer/audience/JWKS validation, linking proof, secure verified callbacks and account recovery; only then enable Sign-in buttons.
2. Verified SMTP and/or sender API adapters in Integration Store, encrypted custody, step-up and signing, health probe and unambiguous delivery receipts; outbox worker with crash recovery, retry cap, dead-letter, retries and consent/suppression/audit. Failover must not duplicate uncertain accepted sends.
3. Tax legal rules per tax jurisdiction, immutable invoice snapshots and order quote/purchase totals matching verified price calculations. An editable tax flag alone does not alter checkout.
4. Full operational Security/Cron/Credits and issued API token policies, each with separate enforcement and source-backed tests. Never make runtime security switches mutable without an independent deployment gate.
5. Authenticated browser six-width validation (320/360/390/768/1024/1440) for all changed Settings routes with concrete screenshot/test receipts; 810-route acceptance remains incomplete.

## Production migration gate
At 2026-10-30 source inspection, **Neon Production** project `falling-surf-50258433`, branch `br-dark-bread-b8j0gqz4`, had **55 migrations, 107 public tables and one `settings_registry` migration**. This differs from the full CI scratch DB baseline (58 migrations/111 tables) because three existing provider security migrations are outstanding in Production, unrelated to this release.

Settings migrations are **additive**:
- `settings_registry.0002_console_policy_defaults` — no-op historical checkpoint, no data rewrite;
- `settings_registry.0003_mail_template_outbox` — create `EmailTemplateRevision`, `ConsoleMailOutbox`, `ConsoleMailAttempt` only;
- `settings_registry.0004_seed_mail_templates` — upsert 12 inactive template defaults with `get_or_create`; no message delivery.

**Do not** blindly execute unscoped `python manage.py migrate` in Production or mark migrations as applied without executing their actual operations. Use the exact Production Django code and DB connection from a restricted certified migrator, take immutable checkpoint, `python manage.py showmigrations settings_registry`, `python manage.py migrate settings_registry 0004 --plan`, rehearse on a verified fresh Neon branch or disposable same-revision clone, then execute `python manage.py migrate settings_registry 0004 --noinput` on production with isolated admin supervision. Verify migrations/tables and preview APIs before routing live UI. No migrations from unrelated providers unless separately approved.

**Known blocker:** Neon project currently rejects creation of an additional review branch (`branches limit exceeded`). Rehearsal in disposable PostgreSQL GitHub Actions is not a substitute for a fresh Production-data clone. Until schema rollout is certified, **do not merge and deploy** the DB-dependent Settings UI into Production, even if code CI is all green.

## GitHub checks and release
Branch `feat/set-batch2-live-console-policy-20261030`, draft PR #101. Gate: frontend tests/build, full Django tests (including three new Settings regression modules), Postgres schema security, source safeguards, migration consistency, then isolated Production schema and authenticated 6-width UI. On green and certified Production schema, merge PR to main, deploy same merge SHA to Vercel `octalve-cloud-api` and `octalve-console`, verify both domain aliases and health/anonymous denials, and retain rollback IDs. Do not claim deployment from an in-progress GitHub workflow.
