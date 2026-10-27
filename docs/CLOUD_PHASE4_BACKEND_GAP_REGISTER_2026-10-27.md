# Octalve Cloud — Phase 4 backend/infrastructure gap register
Prepared 27 October 2026. **Planning inventory, not an assertion that every listed backend feature is missing.** Before implementing any item, review current Django routes/models/migrations, OPanel repository, CI, Neon, actual provider contracts and the relevant prior acceptance evidence. Do not recreate working subsystems. The registry combines observed Batch 8 frontend gaps with earlier Cloud/OPanel requirements.

## Delivery rule and authority
- Repository: `octalve-core/octalve-console` hosts Console frontend and Django API. OPanel remains independent in `octalve-core/octalve-opanel`. Hosting customers use their **existing Console account exclusively**; never introduce separate OPanel customer passwords or signup.
- Maintain exact service ownership, active status and verified successful hosting provisioning before Console offers OPanel launch. Use short-lived, single-use, server-to-server redeemed authorization codes; check replays, audience, tenant, expiry and audit; do not trust any browser-supplied service identifier alone.
- All charges and catalog prices derive from authoritative server-side quotes, snapshots and signed/provider-confirmed settlement. Never activate services from a browser success callback or a UI flag. Supplier cost, markup/discount, customer sales price and margin are distinct.
- Work on Review, qualify with disposable isolated databases / provider sandboxes, SHA-gated PRs and acceptance. Preserve Production DB, Neon recovery branches, and historical migration constraints; no automatic migration, branch deletion, live payment, customer mail or provisioning in qualification.
- Never show unavailable integration as “No records” or simulate a save.

## A. Confirmed missing from Batch 8 Admin workspace integration inventory

The following **eleven workspaces** currently use unconnected frontend loaders; whether their Django equivalents already exist requires endpoint/permission inspection.

| Key | Workspace | Backend work / real acceptance needed |
| --- | --- | --- |
| P4-ADM-01 | Quotes | Tenant-bound quote schema, admin CRUD, quote revision/expiry/acceptance, tax/plan-price snapshot and order/invoice conversion guards. |
| P4-ADM-02 | Batch Billing | Idempotent scheduler, renewal windows, retry/outbox, dry-run approvals and exactly-once invoice effects. |
| P4-ADM-03 | Print Queue | Signed/authorized invoice and receipt PDF generation, queue, privacy, retention and delivery status. |
| P4-ADM-04 | Invoice Designer | Versioned business-owned branded templates, escaped fields, preview/PDF render and permission constraints. |
| P4-ADM-05 | Staff Management | Role/permission grants and revocation, MFA-sensitive actions, onboarding/invitations, session revocation, event auditing and least privilege. |
| P4-ADM-06 | Blacklist | Scoped fraud/abuse rules, separate manual review, expiry, actor and appeal metadata; guard against accidental blocking. |
| P4-ADM-07 | CMS | Approved customer/public content schemas, revision history, content sanitization, publish permissions and cache invalidation. |
| P4-ADM-08 | Currency | Approved FX source, quotes with currency/precision snapshots, rounding rules; no implicit NGN conversion or false exchange-rate display. |
| P4-ADM-09 | Download Manager | Authorized private artifact inventory, expiring scoped downloads, antivirus/checksum validation and audit trails. |
| P4-ADM-10 | Mass Mailer | Permission-scoped templates, approved audience/consent, rate limits, opt-out/unsubscribe, outbox and deliverability state. |
| P4-ADM-11 | Service Queue | Durable lifecycle jobs, retries, dependencies, leases, idempotency, observable human re-drive and ownership checks. |

## B. Business-critical backend/provider gaps and qualification

| Key | Domain | Verify first; implement only proven missing capability |
| --- | --- | --- |
| P4-BIZ-01 | Production catalog & purchase authority | Reconcile public product/plan/category availability, offers, pricing revisions, term cycles, taxes/coupon evaluation and owner-approved product state; do not invent sales content. |
| P4-BIZ-02 | Quote/order/invoice state machine | Verified cross-entity association, immutable quote/price snapshot, unpaid-invoice refusal, cancellation/refunds, no double invoice/service create and durable idempotency keys. |
| P4-BIZ-03 | Payments | Paystack/Flutterwave sandbox and live readiness; hardened webhook signature/raw-body verification, deduplication, server-to-provider verify, atomic settlement, replay checks, reconciliation and refund controls. No collection during UI QA. |
| P4-BIZ-04 | Gateway administration | Secrets write-only at Django serializer/readback boundary, encrypted at rest with key rotation, masking, least-privileged configuration update, audit and test/live isolation; read-only Paystack overview is **not** payment acceptance. |
| P4-BIZ-05 | Wallet / credit | Ledger vs displayed balances, top-ups, reversals, refunds, race-safe allocations, idempotency, transaction-level audit and financial reconciliation. |
| P4-BIZ-06 | Renewals/suspension | Entitlement/expiry source, dunning, reminders and correct suspend/unsuspend/cancel restoration; never permit unaudited manual paid-status edits. |
| P4-DOM-01 | Registrar adapter | Authoritative domain availability, purchase/renew/transfer/redeem/restoration, ownership/registrant proofs, EPP/registry rules, no fabricated availability; test sandbox before commercial release. |
| P4-DOM-02 | Domain retail margin | Provider wholesale cost versus configurable Octalve resale markup/discount, customer-quoted sale price, cost basis/FX snapshot, margin reconciliation and controlled at-cost offers; never settle below confirmed provider rules. |
| P4-DOM-03 | Registrar routing and registry state | Multi-registrar support, provider failure isolation, rate limiting, name normalization/IDNA, price changes and correct expired/transferred status reconciliation. |
| P4-DOM-04 | DNS/SSL | Nameserver/delegation verification, zone ownership, record edit idempotency, external nameserver state, safe retries/rollback, ACME/paid SSL issuance and renewal; separate OPanel control from registrar authority. |
| P4-INF-01 | Hosting providers | Real DirectAdmin and WHM/cPanel **authorized** adapters and provider approvals, scoped secrets, HTTPS/TLS verification, no credential leakage or arbitrary provider endpoints (SSRF controls). Never label an inventory adapter as operational provisioning. |
| P4-INF-02 | Provisioning worker | Durable queue/outbox/leases, exactly-once-effects-by-idempotency, stale job recovery, exponential retry/backoff, reconciliation and independent verification that external account actually exists before marking service active. |
| P4-INF-03 | Provider lifecycle | Server capacity/package mapping, ownership, activation/suspension/unsuspension/termination gates, operation logs, rollback and self-service safety for client actions. |
| P4-INF-04 | Production hosting footprint | Real provider/server, DNS delegation and network/TLS, runtime and backups qualification; avoid implying discontinued Cloud infrastructure is ready. |
| P4-OPA-01 | Console to OPanel | Service-scoped single-login SSO as above, tenant-bound entitlement, session invalidation, origin enforcement and anti-replay with integration tests across **both repos**. |
| P4-OPA-02 | OPanel feature readiness | Actual customer UI/API contracts for file read/write/rename/delete, bounded uploads, file permission checks, web app deploys, domain/DNS control and infrastructure activation. |
| P4-OPA-03 | OPanel service operations | Durable backups/restores with DB/mail consistency, encryption, scheduling, offsite recovery, restore rehearsals, website runtime PHP/Node/Python, rollback, DNS reload/delegation and external verification. |
| P4-SUP-01 | Support and knowledge | Confirm departments/routing topics, ticket assignment/reply permissions, customer visibility, audit, attachments, moderation and knowledge publication; verify live end-to-end ticket acceptance. |
| P4-SUP-02 | Notifications | Outbox-backed mail, verified templates, email verification/reset, event deduplication, resend policy, bounce status and hosting-ready messaging after truly successful provisioning. |
| P4-SEC-01 | Account and RBAC | Verify current auth/migration state and SEC-01 negative tests; role/ownership enforcement at every Django endpoint including delegated resources, session expiry, auth throttling, MFA for administrators and audit events. |
| P4-SEC-02 | Backend serializer/mutation contract | Endpoint inventory and OpenAPI contract for all editable Admin resources; PATCH merge semantics, required IDs, immutable financial fields, explicit clearing, filter/pagination, error envelope and exact readback. |
| P4-SEC-03 | Security operations | Secrets/PII redaction, SSRF controls for provider URLs and webhooks, audit integrity/retention, request throttles and alerting, backup encryption, least privilege and emergency recovery. |
| P4-OPS-01 | Release / acceptance | Production Neon ledger and recovery checkpoint read-only verification; separate isolated Review database; live Client/Staff/Admin authenticated smoke tests and Vercel Console/API exact SHA alias checks. |
| P4-OPS-02 | Observability | Correlation IDs across Django, BFF and providers; metrics/alerts for payment, webhook, renewal, queue backlog and OPanel failed launch; tested disaster-recovery runbook. |
| P4-OPS-03 | Compliance | Provider terms/merchant onboarding, billing legal/tax treatment, customer consent/privacy, domain registration disclosures, retention and role-based export/deletion workflows. |

## C. How to resolve each item
For each key create: (1) current routes/models/tests and existing capabilities, (2) unmet behavior with reproducible failing test, (3) security/authorization and state-machine contract, (4) provider/sandbox dependencies, (5) isolated implementation PR, (6) backend unit/integration tests + read-only production smoke, (7) production release and rollback proof.

Prioritize P4-SEC-02 / P4-BIZ-03 / P4-INF-02 / P4-DOM-01 / P4-OPA-01 as release-affecting contract audits; plan Admin extras separately by actual commercial importance. This register is not permission to create speculative money movement, migrations or provisioning.

Standards: [OWASP ASVS 5](https://asvs.owasp.org/), [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
