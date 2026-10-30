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

Settings migrations are **additive** and now include tax history:
- `settings_registry.0002_console_policy_defaults` — no-op historical checkpoint, no data rewrite;
- `settings_registry.0003_mail_template_outbox` — create `EmailTemplateRevision`, `ConsoleMailOutbox`, `ConsoleMailAttempt` only;
- `settings_registry.0004_seed_mail_templates` — upsert 12 inactive template defaults with `get_or_create`; no message delivery.
- `settings_registry.0005_tax_policy_revision` — add an append-only owner policy history table; no financial activation.

**Do not** blindly execute unscoped `python manage.py migrate` in Production or mark migrations as applied without executing their actual operations. Use the exact Production Django code and DB connection from a restricted certified migrator, take immutable checkpoint, `python manage.py showmigrations settings_registry`, `python manage.py migrate settings_registry 0005 --plan`, rehearse on a verified fresh Neon branch or disposable same-revision clone, then execute `python manage.py migrate settings_registry 0005 --noinput` on production with isolated admin supervision. Verify migrations/tables and preview APIs before routing live UI. No migrations from unrelated providers unless separately approved.

**Known blocker:** Neon project currently rejects creation of an additional review branch (`branches limit exceeded`). Rehearsal in disposable PostgreSQL GitHub Actions is not a substitute for a fresh Production-data clone. Until schema rollout is certified, **do not merge and deploy** the DB-dependent Settings UI into Production, even if code CI is all green.

## GitHub checks and release
Branch `feat/set-batch2-live-console-policy-20261030`, draft PR #101. Gate: frontend tests/build, full Django tests (including three new Settings regression modules), Postgres schema security, source safeguards, migration consistency, then isolated Production schema and authenticated 6-width UI. On green and certified Production schema, merge PR to main, deploy same merge SHA to Vercel `octalve-cloud-api` and `octalve-console`, verify both domain aliases and health/anonymous denials, and retain rollback IDs. Do not claim deployment from an in-progress GitHub workflow.


## Continuation review (30 October, subsequent implementation)

The source review exposed a template revision bug: history snapshots were recording the
PREVIOUS value rather than the freshly saved version. This is corrected. Admins
can now inspect the latest 30 revision snapshots using
`GET /api/settings/console-mail/templates/<id>/history/`, and the Workbench
renders them as React text, never as executable HTML. Revision/attempt records
refuse updates or deletes through their model methods; this is application-level
tamper resistance, **not** a claim of a WORM database or independently stored audit.

The `mail_dispatch.deliver_queued_once` state machine is written and tested,
but remains **internal and unregistered** until a certified sender is available.
It requires an explicit certified adapter and provider receipt, tries an ordered
fallback only after definitive refusal, caps attempt cycles, schedules bounded
backoff and sends unknown/timeouts/worker interruptions to `needs_review`.
No external HTTP endpoint can initiate sending; no adapter currently meets the
Integration Store's live operational certification.

The invoice-issued path records an idempotent queued event only when the
`invoice_issued` template is active. All templates are initially inactive;
this path neither delivers email nor changes settled payments or invoice values.
An invalid active template cannot prevent financial issuance. Separate signed
payment success and expiry/domain/support event emitters are still required.

The approved Theme density choice also uses one canonical
`--console-panel-padding` CSS variable shared by every design-system Panel.
Defaults preserve existing Octalve canvas colours and spacing.

The new frontend source guard verifies that operator forms call real Django
read/write endpoints, public theme tokens are bounded, Notifications uses the
real outbox, and uncertified OAuth controls stay hidden. Django tests include
template revision visibility, safe token escaping, staff/client denial, accepted
and ambiguous delivery receipts, retry/failover rules and crash quarantine.

### Security references and design decisions

- OWASP OAuth 2.0 Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
  — PKCE/state/nonce, issuer checks and browser-bound transaction state are
  necessary before any social OAuth UI activation.
- OAuth 2.0 Security Best Current Practice, RFC 9700:
  https://www.rfc-editor.org/rfc/rfc9700.html
  — exact redirect matching and no open redirector or implicit token grant.
- Django 6.0 QuerySet locking:
  https://docs.djangoproject.com/en/6.0/ref/models/querysets/
  — `select_for_update` is transactional in PostgreSQL and cannot be assumed
  to behave identically on SQLite; disposable PostgreSQL tests remain mandatory.
- Django transaction `on_commit`:
  https://docs.djangoproject.com/en/6.0/topics/db/transactions/
  — sending should never occur inside pricing/payment transactions; durable
  queue intent and independently certified dispatch retain authority.

### Definitive remaining acceptance holds

1. **Production schema:** create/reuse a formally dedicated *fresh* Neon
   Production clone after resolving the project branch limit; do not rewrite
   preserved recovery or unrelated preview branches. Apply only the reviewed
   Settings migrations to that clone; then make the documented independent
   Production migration and verify readback.
2. **Email sending:** certify integration vault custody, individual senders'
   real provider acceptance receipts, bounded network endpoints, operator
   sender priority, suppression/consent records, restartable worker and bulk
   campaign limits before any external delivery is enabled. The internal
   dispatch state machine is not a certified mail service.
3. **OAuth:** add tested Google/Apple/Facebook server-side callback contracts
   and verified account linking, and enable provider buttons only after
   configured real credentials and authorization tests.
4. **Tax:** jurisdiction-sensitive legal/financial rules, quote/order agreement,
   versioned tax snapshots and historical invoice immutability; no automatic
   activation simply because `TaxSettings.enable_tax` is true.
5. **Global operations:** independently enforced Security/Cron/API-token and
   public configuration settings, six-width authenticated browser receipts, and
   exact-SHA release/rollback verification. Until all release gates are
   satisfied, keep PR #101 as draft and Production on the Batch 1 SHA.

## SET-03 continuation: audited tax policy history

Tax GET now does not create a database row. Saved, verified changes record an immutable application-level snapshot, revision number and actor, with a Super-Admin-only readback route and a read-only history panel. They do not recalculate already issued invoices or activate checkout taxation. Scratch CI must now account for 62 migrations and 115 tables versus the current observed Production 55/107. The difference does NOT authorize unrelated supplier security migrations.

Tax compliance references: National Assembly Nigeria Tax Act 2025 https://nass.gov.ng/documents/download/11249 ; regional and product-based tax computation and exemption guidance https://support.stripe.com/questions/understanding-tax-rate-calculations-with-managed-payments . Legal rules, effective dates, product tax codes and customer location must be established before rate edits can affect final financial quotes.

## 30 October — local Production migration route and Brevo-first email onboarding

**Source-based correction to the old branch-only release hold:** previous rewards
migrations used checked-out local `main` + a secure Windows PowerShell
`-PlanOnly` pass, an exact Neon direct URL, real `manage.py migrate` with
a typed approval, and read-only postflight. **A new Git or Neon branch is not
intrinsically required to run Django migrations.** A current restorable
checkpoint is still required. The project currently has ten Neon branches
and a single older snapshot; both additional Neon branch creation and
snapshot creation were refused with plan-limit errors. Preserve all existing
recovery records.

After a green and reviewed PR #101 is merged into `main`, with Vercel
autodeploy disabled, run these commands **from the clean local main checkout**
under Windows PowerShell, using an operator-controlled workstation. Use
Python 3.12 with the repository's pinned `backend/requirements.txt`
and a compatible PostgreSQL `pg_dump`/`pg_restore` client:

```powershell
git fetch origin main
git checkout main
git pull --ff-only origin main
git status --short
powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-production-settings-batch2.ps1 -PlanOnly
powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-production-settings-batch2.ps1 -Apply
```

Both invocations request the Neon Production **DIRECT** database URL using
PowerShell hidden input. Never paste the URL into chat, output or Git. The
script checks exactly `ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech`,
`neondb_owner`, `neondb`, SSL, `55 migrations / 107 tables`, the
authentication security baseline, the exact four pending Settings migrations,
and no unrelated provider migrations. A clean main working tree is required.
The Apply pass creates a new local custom-format pg_dump archive, verifies the
archive's listing/checksum/size, and requires typing
`APPLY SETTINGS 0002-0005 TO OCTALVE PRODUCTION` inside the CLI before any
migration executes. This archive is **not automatically encrypted**: use
BitLocker or another approved encrypted private volume; never upload it.
Restore rehearsal against a separate local/disposable database is strongly
recommended before an irreversible operation. A TOC check alone does not
certify restore recovery. Production postflight is **59 migrations / 111
tables**, four new Settings tables, and all twelve seeded template keys.

**Do not run** `python manage.py migrate` unscoped, delete Neon recovery
branches, use the pooled Neon URL, or put Production connection secrets in CI.
The old `apply-neon-production-rewards.ps1` is a historical example and
cannot be reused: its 54/100 initial-state guard no longer applies.

### Live deployment dependency

The `settings_registry` 0003/0005 tables are called by the Admin email/tax
read endpoints. Finish the one-off migration and independently verify its
ledger **before** deploying the corresponding backend+frontend Production
SHA. GitHub source CI and a disposable PostgreSQL review are not a substitute
for this. Existing Vercel config has Git deployments disabled on `main`;
use one explicit production deployment per project on the same merged SHA.
Record deployment IDs, verify canonical domain aliases, API health, denied
anonymous Settings access and Admin read/write behavior.

### Brevo primary + Resend fallback onboarding

Integration Store registry now lists both Brevo and Resend as draft-only
transactional senders. Console Mail saves a **preference** for Brevo first and
Resend second but cannot enable them until the following are true:

1. Own and authenticate a branded sending domain in Brevo/Resend. Publish the
   exact provider-supplied DKIM records and appropriate SPF/DMARC policy. Do
   not create multiple SPF or DMARC TXT records for one name. Confirm
   alignment for the visible From domain.
2. Configure real transactional sender identities and reply-to addresses,
   verify the domain in each provider, and use narrow provider API keys in
   protected Integration Store/key custody, never a customer-facing form.
3. Certify provider API submission receipts, soft/hard bounce and spam
   suppression, transactional webhooks with authentic event verification,
   deduplication, quota throttling, complaints and recipient consent for
   promotional messages. Brevo free currently advertises 300/day and a
   bounded over-quota transactional holding queue.
4. Only after all checks should a durable worker select an enabled provider.
   A definitive provider refusal can trigger Resend; a timeout/unknown
   acknowledgment must go to reconciliation to avoid duplicate delivery.
   The internal dispatch state machine is implemented but is **not** a
   certified live network service.
5. Inbox placement cannot be guaranteed. Validate SPF/DKIM/DMARC,
   reputation/warm-up, valid text+HTML, aligned links and low complaints
   before promising improved inbox delivery.

Official sources:
- https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC
- https://developers.brevo.com/reference/send-transac-email
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- https://resend.com/guides/email/deliverability/why-emails-go-to-spam
- https://resend.com/changelog/idempotency-keys
