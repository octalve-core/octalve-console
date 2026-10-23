# Octalve Cloud — C1 architecture and implementation specification
**Review baseline:** `octalve-core/octalve-console@d7937e95a904148d221719a6b0f9ee056d7ef2db`  
**Date:** 2026-10-23  
**Status:** Implementation work under review; not a production qualification.

## 1. Product authority: one platform, separate applications
| Component | Owns | Does not own |
|---|---|---|
| `octalve-core/octalve-cloud` | Public brand website, catalogue presentation, leads, verified domain discovery | Hosting automation, financial authority |
| `octalve-core/octalve-console` frontend | Customer/admin/staff account management, plan/order/invoice/payment display, service ownership and support | Technical host/root operations |
| Existing Django API | Users, tenants, roles, catalogue, immutable priced orders, invoices, settlement, subscription/service entitlements, audit | Direct unbounded shell access |
| Future `octalve-core/octalve-opanel` | Technical website/app/file/database/SSL/DNS/deployment/backup UI within grants | Business subscriptions, billing, plan authority |
| Future execution agent(s) | Restricted host operations, provider adapters, queues/reconciliation | Customer pricing and invoicing |
| Future Octalve Mail | Mailbox data, delivery, spam/abuse controls, IMAP/SMTP infrastructure | Business invoicing |

The OPanel frontend is a separate Next.js project. It exchanges short-lived single-use scoped authorization grants with Django; no browser receives root/server-admin credentials. Initially the Django authority backend is **shared** but endpoints and roles are partitioned. Extract Django into a dedicated API repository only after business contracts and DB migration practices stabilize.

## 2. Deployment selection
| Hosting | Strength | Constraint | Recommendation |
|---|---|---|---|
| Vercel | Excellent native Next.js, preview, now supports Python/Django GA (2026-10-15) | Hobby restricted to non-commercial personal use; function environment unsuitable for traditional persistent workers | Frontend when eligible, optionally API for stateless requests |
| Render | Standard Django Gunicorn process, simple repository deployment | Free instances sleep after 15min, ephemeral disk, no reliable background worker; free Postgres expires in 30 days | Prefer for conventional Django development API |
| External PostgreSQL | Independent persistent SQL storage | Free limits, connection pooling required | Select durable dev DB, never SQLite in remote ephemeral compute |
| Future Octalve server | Control over Node, Python, PostgreSQL, queues and agents | Real capex/ops and disaster recovery work | Move identical app via release images/config and tested data migration |

Vercel can import `frontend/` and `backend/` as separate projects from one repository, but its SDK services must remain deployment adapters rather than internal application domain models.

### Isolated review environment
- Frontend: private/protected review URL; Next.js runtime with exact `NEXT_PUBLIC_API_BASE_URL=https://<review-api>/api`.
- Django: standard WSGI/ASGI app under HTTPS; `DEBUG=false`, explicit `DJANGO_SECRET_KEY`, `ENCRYPTION_KEY`, `DATABASE_URL=postgresql://...`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`, `EMAIL_BACKEND`.
- Do not paste credentials into GitHub, PRs or chat. Configure secrets in each hosting platform. Verify DNS before modifying any record.
- Build: pin Python/Node versions and lock dependencies. Run Django migrations as a separately approved deployment step, not from live web requests.
- Storage: no persistent local filesystem. Use S3-compatible object API.
- Jobs: no privileged provisioning from a web request handler. For review use deterministic simulator and explicit test worker; later adopt PostgreSQL transactional outbox and durable queue/lease worker.
- Payment: gateway sandbox only, test webhooks signed and independently reverified. Actual billing remains blocked pending full settlement implementation.

### Octalve-hosted migration contract
Define `DATABASE_URL`, application secrets, service endpoints, object-storage endpoint, queue/worker service and provider adapter config independently of Vercel/Render. Retain Docker/Compose/Kubernetes-compatible app launch instructions. Verify backup + restore, migration reproducibility, TLS, log retention, data isolation and DNS rollback. Only after app verification replace simulated adapter with audited real server integration.

## 3. Panel and infrastructure research
| Product | Verified integration surface | Octalve decision |
|---|---|---|
| Hostinger hPanel | Proprietary Hostinger dashboard; Hostinger public APIs manage Hostinger accounts/VPS/domains | **UX reference**, not assumed self-hosted panel |
| DirectAdmin | New `/api/` JSON, legacy `CMD_API_*`, restricted Login Keys, per-server Swagger specification | First shared hosting provider adapter |
| cPanel & WHM | WHM API 1 server/reseller, UAPI inside hosted accounts | Second provider adapter |
| Plesk | REST API v2; some features only in legacy XML API | Optional adapter after endpoint verification |
| HestiaCP | Remote API with IP restrictions and keys | Potential self-managed reference |
| CloudPanel | Management commands under `clpctl`, PHP/Node/Python support | Host-side agent reference; not directly expose shell to UI |
| Coolify | REST API to manage apps, databases, servers and deployments | Application hosting adapter |
| Proxmox VE | REST API for hypervisor, clusters, VMs and containers | Virtualization execution plane |

Do not replicate panel brands or their proprietary code. Design Octalve-specific business journeys and a common capability contract; feature flags reflect what a particular adapter can actually execute. Every technical operation returns `requested`, `queued`, `running`, `confirmed`, `failed` or `needs_review` based on real evidence.

## 4. Backend / frontend implementation order (by acceptance, NOT calendar)
**C1: Foundation**
1. Audit existing code, routes and serializer shapes; reproduce builds.
2. Isolated real PostgreSQL database and a Django health endpoint with safe diagnostics.
3. Real signup/login/current user/logout, password reset in test mail, roles/tenants and negative API tests.
4. Review frontend + live API; no fictional fallback records, explicit loading/error/empty states.
5. CI checks, dependency locks, repeatable portable deployment instructions.

**C2: Commerce**
1. Server-owned plan and pricing contract; no browser-trusted amount.
2. Unique order + invoice transactional creation, existing IDs preserved.
3. Paystack sandbox initialization, redirect and webhook callbacks.
4. Provider re-query verifies `successful`, reference, merchant, amount, currency, invoice and user.
5. One idempotent atomic settlement service used by both paths. Transaction + invoice + outbox committed in the same DB transaction.
6. Duplicate callbacks, partial payments, refunds, failed provider requests, and unexpected currencies covered by regression tests.

**C3: Operations**
1. Deterministic simulated provider matching real adapter schema; do not fake hardware provisioning.
2. Provider inventory and package mappings bound to live catalogue.
3. DB task leases, idempotency, retries, fixed timeouts, state reconciliation, credentials redaction.
4. Actual real-host test only on approved sacrificial server when available.
5. Service status must reflect confirmed provider state.

**C4: OPanel**
1. Separate Next.js repository. Shared styles/tokens only, no Console UI fork.
2. Short-lived, single-use, service-scoped handoff; recheck server-side authorization on every request.
3. Implement first site, file, domain/zone and database operations over a restricted agent.
4. Command templates, validated inputs, scoped paths, no arbitrary command execution.
5. Record audits, rotation/revocation, backups and recovery evidence.

**C5: Production**
Isolated production data, hardening, WAF/rate limits, MFA, approvals, email deliverability, backups, DR, live provider integration, legal/commercial checks, load test, phased rollout.

## 5. Threat model and security verification
**Assets:** customer and organization identities, host access credentials, payment truth, DNS/domain control, server operations, private project workloads, audit history.  
**Abuse cases:** BOLA/IDOR, mass assignment, horizontal/vertical privilege escalation, signed webhook with wrong amount, token theft, duplicate callbacks, forged provider operations, log credential leakage, SSRF, shell injection, accidental deletion, cross-tenant migrations.  
**Principles:** server authorization at every hop; separate tenant/service IDs; least-privilege provider tokens; validate provider return and reconcile; no successful settlement based on frontend redirects; immutable financial events; audit without secrets; explicit retry policies; isolated operational identities.
**Controls framework:** OWASP ASVS 5.0 Level 2 with additional controls for privileged infrastructure functions, OWASP API Security Top 10 2023 and NIST SP 800-218 SSDF 1.1. Requirements are acceptance criteria, not a certification claim.

## 6. Verified implementation facts and remaining blockers
- Django does contain accounts, catalogue, invoices, payments, services, providers and provisioning modules. Full integration tests are not yet demonstrated.
- Next.js 14/React 18 frontend has extensive routes but some screens show demo data on API failure; Next.js 16 migration must be separate.
- Current JWT state is duplicated in sessionStorage and HTTP-only cookie flow; migrate to one secure session authority.
- **C1 changes now guard** signatures and privileged task creation, redact provider logs, and allow explicit portable `DATABASE_URL`. Signatures are provider-specific: Paystack HMAC-SHA512 and Flutterwave **v3** `verif-hash`; Flutterwave v4 differs.
- Signed webhook events intentionally remain **pending reconciliation**. The old processors cannot be accepted as payment truth; redirect flow is similarly quarantined until authoritative provider amount/currency verification and atomic settlement.
- Remaining: actual settlement worker; service/other serializer negative tests; task leases; domain registrar proof; complete OPanel frontend; server infrastructure; real browser/API tests.
- Legacy SSH deploy still targets intentionally cancelled server. No `main` promotion or production server resubscription without user authorization.

## 7. Official references
Hostinger https://www.hostinger.com/support/10840865-what-is-hostinger-api/  
DirectAdmin https://docs.directadmin.com/developer/api/  
cPanel https://api.docs.cpanel.net/whm/introduction  
Plesk https://docs.plesk.com/en-US/obsidian/api-rpc/about-rest-api.79359/  
CloudPanel https://www.cloudpanel.io/docs/v2/cloudpanel-cli/root-user-commands/  
Hestia https://hestiacp.com/docs/server-administration/rest-api  
Coolify https://coolify.io/docs/api/overview  
Vercel Django https://vercel.com/changelog/python-on-vercel-is-now-generally-available  
Render https://render.com/docs/free  
OWASP ASVS https://asvs.owasp.org/  
OWASP API https://devguide.owasp.org/en/07-training-education/07-api-top-ten/  
NIST SSDF https://csrc.nist.gov/pubs/sp/800/218/final
