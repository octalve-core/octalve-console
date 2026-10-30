# Octalve Cloud — Complete System Audit and Delivery Gap Register
**Audit date:** 30 October 2026 (Africa/Lagos)  
**Scope:** Octalve Console/Django API `octalve-core/octalve-console`, read-only cross-repository dependencies on public `octalve-core/octalve-cloud` and independent `octalve-core/octalve-opanel`.  
**Verified Console source:** `d7825d7e58ffb36b7105c1ef32e9faa408d2b044` before this documentation-only cleanup.  
**Live environment:** `console.cloud.octalve.com`, `api.cloud.octalve.com`, public `cloud.octalve.com`.  
**Classification:** Read-only audit and actionable work programme. **Not** launch certification, financial approval, permission to enable gates or proof of authenticated browser acceptance.

## 1. Executive conclusion

**Octalve Cloud has a deployed functional management foundation, not yet a commercially complete hosting platform.** The Console and Django API have READY Vercel Production deployments on the same verified source SHA. Neon Production has 59 applied migrations and 111 tables. The Console contains **135 actual Next.js pages**: 85 Admin, 33 Client, 10 Staff, 7 public/auth. These are **routes implemented**, not 135 tested customer journeys; the 135 × 6 = **810 authenticated viewport acceptance matrix remains unexecuted**. Django code and automated tests are extensive and meaningful but cannot substitute for vendor and production evidence.

The decisive business blocker is live catalogue/infrastructure authority. A read-only Production database query on 30 October found **zero published catalogue offers, zero publicly active products/plans and zero supplier rows**. The public `GET /api/storefront/plans/` independently returned `{"plans":[]}`. Customers cannot buy a verified sellable hosting package through that published catalogue today. The public homepage markets domains, uptime and launch claims but registrar availability remains unverified and externally executed provisioning remains gated.

**Security-positive result:** many high-risk mutations are deliberately closed or versioned, including direct customer balance/role edits, invoice amount changes, provider writes, domain NS/DNS writes, wallet application, unqualified financial settlement and rewards release. Keep these controls closed until the exact adapter/financial proof is independently approved.

**Production release status:** the Batch 2 frontend and API are deployed at the same SHA, the four Settings migrations were applied with a guarded local backup and the legal/security/finance/external gates in this register remain independent and open.

## 2. Evidence and confidence rules

- **VERIFIED-LIVE** — observed through Production alias, read-only Neon query or anonymous live HTTP request during this audit.
- **SOURCE+CI** — files, Django models, routes and regression workflows actually exist. Not live provider certification.
- **SOURCE-GATED** — implementation or contracts exist but default-off flags, unavailable vendor proof, disabled actions or missing Production schema block execution.
- **NOT IMPLEMENTED/CERTIFIED** — no qualified end-to-end operational contract or evidence was found; some preparatory code may exist.
- **UNKNOWN** — needs permissioned browser/vendor/operator observation. Do not infer from UI or a historical document.
- Historical batches are *point-in-time evidence*. Do not reuse their SHA, domain, migration count or old plan as today's execution command.

Evidence snapshot:
- GitHub Console `main`: `d7825d7e58ffb36b7105c1ef32e9faa408d2b044`.
- Console Production alias → Vercel deployment `dpl_rY3xESxwDpipnJSEZCzR8qJ5bTSi` READY, matching source SHA.
- API Production alias → Vercel deployment `dpl_9abmspLN1aK1A3LCHTdCxtBg5M15` READY, same SHA.
- `/api/health/` responded `{"service":"octalve-cloud-api","status":"ok"}`; anonymous Console login rendered.
- Neon Production: 59 migrations, 111 base tables, 4 new Settings migrations; 12 seeded email templates, **zero active**, zero queued mail items; no public catalogue data or supplier rows.
- Production `providers_integrationconnection` table **does not exist**, while `backend/providers/migrations/0002_integration_draft_vault.py` and later 0003–0004 source migrations exist. These are *not part of the completed Settings 0002–0005 rollout*.
- Public `/terms-of-service` and `/privacy-policy` returned HTTP **404**. Both need actual owner-approved corporate policy documents and working routes before large-scale customer signup.
- Public homepage showed duplicated `99.99% Uptime` copy and a domain-extension claim unsubstantiated by current registrar/catalogue evidence.
- Actual source `frontend/src/app/globals.css` is approximately 52 lines / 1.1 KB; older docs claiming an 8,526-line file or 134 routes are historical and must not direct new work. React still uses small approved CSS Modules for auth/reports.

## 3. Complete user-journey audit

| Stage | Implemented and qualified in source | Actual remaining business requirement | Gate |
|---|---|---|---|
| Discover Octalve Cloud | Public Next.js site exists; homepage, domain search presentation and marketing pages render. | Confirm truthful claims; approved legal and domain links; full accessibility and SEO browser checks. | P0 |
| Check plans and availability | Django published-offer catalogue, versioned plans/cycles, price and category APIs. Source enforces supplier evidence and non-negotiable checkout snapshot. | **Publish real approved supplier-backed products and offers; Production currently empty**. Real registrar API required for availability. | P0 |
| Register/login | Five-screen Next.js auth UI, Django JWT/BFF controls, verification/recovery endpoints and throttling source. | Verify real email delivery and recovery flow; legal Terms/Privacy 404; independent role/session browser and abuse tests. | P0 |
| Basket/quote/order | Exact plan/cycle selection, server-priced read-only quote, transactional Order and pending Invoice models, coupon validation and over-claim rejection. | One real end-to-end paid order with authentic supplier cost, tax/fee agreement and failure handling. | P0 |
| Hosted checkout | Paystack/Flutterwave selected-code adapters, invoice-bound payment intent, hosted URL and gateway readback/settlement source. | Activate only after verified live/sandbox gateway connection, webhook replay/reconciliation, refund/chargeback qualification. `CLOUD_*PAYMENT*` and settlement flags default false. | P0 |
| Invoice and receipt | Template 01 isolated under `backend/billing/invoice-template/`; PDF and versions, prefix/branding and immutable issue-time operator policy snapshot. | Invoice actual paid/void/credit/refund authority, regional tax, compliance, audit, recurrence, customer self-service acceptance. | P0/P1 |
| Automatic hosting | Verified-payment-to-provisioning qualification, idempotent staging contracts, worker scaffolding and supplier inventory verification. | Real DirectAdmin/WHM certified customer creation, signed receipts, retries/cancellation and isolated recovery, then enable relevant flags. | P0 |
| Technical access | Independent OPanel repository, SSO/entitlement bridge, native filesystem/DNS/backup/website prototypes and tests. | Real hosting account, account-scoped SSO exchange, live endpoint/VPS, file/DB/mail backups, HTTPS and public website proof; independent OPanel live release. | P0 |
| Domain ownership | TLD pricing models, domain data, registrar quote and safe transfer/renewal readiness response. | Live registrar availability/registration/transfer/EPP/renewal/NS/DNS/SSL, verified billing and expiry notifications. | P0/P1 |
| Account and wallet | Customer profile, read-only ledger/wallet balance, masking, profile/role injection rejection, support self-service. | Paystack/Flutterwave verified wallet funding, immutable idempotent ledger settlement, refund/chargeback, multi-role account grant. Manual funds must stay blocked. | P1 |
| Notices/support | In-app notification and support models/routes; 12 editable mail templates, safe escaped personalization, revision/audit, durable outbox and bounded state machine. | Brevo primary + Resend backup domain/API certification, sender verification, worker, signed feedback, opt-in/out and suppression, transactional account recovery. | P0/P1 |
| Renewal/cancel/refunds | Renewal status, invoice preflight, safe lifecycle requests, payment reconciliation source. | Real scheduler/worker and verified supplier outcomes, refunds, failed-payment automation and audit-ledger reconciliation. | P0/P1 |
| Ongoing customer support | Tickets, assignment/routing and KB/reporting source, client and staff dashboards. | SLA/notification workflows, staff-assignment boundaries, operational performance evidence, actual external delivery. | P1 |
| Growth/affiliate | Rewards/affiliate models, anti-fraud financial checks, dashboards. | `REWARDS_API_ENABLED` defaults false; proven award/redemption/affiliate payouts, legal/KYC/fee controls before enablement. | P2 |

## 4. Backend architecture, security and operational gaps

### 4.1 Identity, permissions and access boundaries — P0
- Core: Django `accounts`, custom JWT/session BFF, password/email flows, throttles, `rbac`, staff roster; no browser JWT web storage by design.
- **Authorization audit needed:** `backend/orders/views.py::OrderViewSet.get_queryset` returns `Order.objects.all()` for the `staff` role. Review intended Staff responsibilities, assigned customers, tenant scoping and per-action permissions before a staff release. Do not assume every staff member can read every customer's purchases. Some other read paths use broad role/superuser OR checks; replace with explicit permission matrix and deny-by-default tests where appropriate.
- Current user model uses single `role`; customer-to-staff promotion while retaining personal client workspace requires additive grants, real MFA, session-bound workspace selection, no impersonation and revocation. Generic writable role fields were removed from customer editor, not replaced by full dual-role identity.
- Social OAuth Google/Apple/Facebook **unconnected**; login buttons hidden. Demand authorization code + PKCE/state/nonce, exact callback allowlists, issuer/audience/JWKS, linked-identity proof and logout/revocation/CSRF tests before enabling.
- Provider vault includes review-only step-up logic; do not confuse it with complete Console login MFA or external KMS/HSM/immutable audit acceptance. Follow OWASP ASVS 5.0 for authorization, session management and sensitive actions.

### 4.2 Configuration and integration authority — P0
- `settings_registry` now has superadmin-only, revision-bound server-persisted Console policies, tax history, theme, invoice prefix/template, escaped mail templates, outbox and readiness reporting.
- Tax configuration is saved but **not activated in checkout**. Checkout currently reports `tax_total: "0.00"` from source; do not advertise stored tax percentages as chargeable.
- Mail dispatch logic is internal **unregistered**. No certified external worker, provider receipts, webhook feedback, replay-safe suppression, marketing consent service or guaranteed delivery. Initial 12 templates inactive; outbox empty. Brevo and Resend are draft integration types, not connected service accounts.
- **Provider Production migration gap:** 0002 draft vault, 0003 TOTP and 0004 integrity source models exist but matching newer provider tables are absent from live Neon. Before provider connections, perform a new independent migration preflight with exact dependencies, snapshot, restore, observed 59/111 ledger and separate owner approval. Never apply these migrations as an unscoped batch.
- Settings vs Integrations vs Provisioning boundaries are implemented in intent. Keep secrets entirely in verified Integration Store custody; never use a plain Settings field for live provider credential entry.

### 4.3 Financial authority and reconciliation — P0
- `payments/settlement.py`, `payments/webhook_inbox.py`, `provisioning/fulfillment.py` each refuse execution unless their corresponding environment release gates are explicitly enabled. Source tests validate validation/idempotency/reconciliation paths, but absent vendor success cannot be inferred.
- Build and test payment-intent lifecycle (including provider status, duplicate event, partial settlement, failure, cancellation, expired checkout, refund and chargeback), then prove amount/currency/order/invoice snapshots cannot be mismatched. Separate release gates for Paystack, Flutterwave, wallet top-up and affiliate payouts.
- Invoice issuance and PDF exist. Region-specific tax classification, country exemptions, effective-date tax rate and quote→order→invoice invariant need independent legal/accounting review. No retroactive edits of issued invoices. Credit notes/partial refunds need scope-specific authorization.
- Wallet has row-locked ledger authority and disabled manual adjustment/application. Implement dedicated verified wallet funding and reversal, do not promote account editable balance.

### 4.4 Domain, hosting and OPanel — P0
- Catalogue publish requires an approved, connected, test-healthy supplier; Production has no supplier records, so a real public offer cannot yet legitimately be sold. First certify supplier inventory and the commercial margin/price cycles.
- Registrar quote is not availability: `PublicDomainLookup` returns `availability:"unverified"` and `registrar_connected:false`. Domain writes return HTTP 503 until approved supplier execution. Need real registrar sandbox, transfer ownership/EPP, status recovery, DNSSEC where supported and renewal/expiry reconciliation.
- Console OPanel issue flag `OPANEL_ISSUER_ENABLED` defaults false. Independently verify active service and ownership, provisioned account, single-use short-lived server redeemed code and OPanel session. Native file/DNS/SSL/backup prototypes must never be described as real Internet hosting until a VPS/server and external tests prove it.
- One real paid hosting plan through public→Console→payment→provider→OPanel→HTTPS website should be the first external MVP acceptance, under explicit account and payment test boundaries.

### 4.5 Reliability, jobs, observability, recovery — P0/P1
- There are Django management commands and models for provisioning/report schedules, plus retry/proof interfaces; a command's existence does not show a continually operating worker in Vercel. Certify separate bounded worker/queue/scheduler, dead-letter and replay approval, correlation IDs, outbound egress, loss/interruption/restart safety and vendor outage handling.
- The Settings local migration produced a verified local pg_dump **archive/TOC/checksum**, but that alone is **not an isolated restore test**. Neon project branch/snapshot creation was refused at the existing plan limit during Batch 2. Preserve existing recovery points; perform and record independent encrypted restore/recovery testing.
- Add Production deploy rollback drills, DB backup retention and restore time, error/latency/financial reconciliation dashboards, rate/abuse alerts and incident response. Health 200 is only liveness.
- Explicit data retention, operational audit and secret rotations; provider WORM/KMS/egress gating remains separate from superficial readiness cards.

## 5. Frontend architecture and experience gaps

**Verified source foundation:** Next.js/React/TypeScript, Tailwind tokens, Lucide, reusable `ActionButton`, `Panel`, shared `RecordDirectory`, responsive workspace shell, five auth pages, Admin/Client/Staff dashboards, checkout/cart, domain search, Catalogue Workbench, service/support views, settings and reporting. `frontend/src/app` contains 135 source routes.

**Incomplete or requiring real browser qualification:**
1. **810 cases** — 135 routes × 320/360/390/768/1024/1440 pixels require authenticated role-scoped screenshot, overflow, keyboard, focus, dialog, loading/empty/error and live API acceptance. `frontend/scripts/check-batch15-browser-gates.cjs` is a **synthetic attestation fixture** and explicitly disclaims authenticated execution.
2. Server-wide pagination/search/filter/sort is implemented for Admin Customers. Client invoices/orders and several Admin operation directories use the same *visual* component but filter returned API collections locally. Implement canonical server contracts with accurate global counts, filters, sort and exact-ID detail for every resource, and tests for page 2+.
3. Show truthful disabled/connected state for domains, payments, provider workflows, wallet and OPanel. No simulated results, no unauthenticated staff/Admin workspace switching or fake numeric KPIs.
4. Real email sender and social provider activation must be reflected in UI only after backend health/proof, not from local settings alone.
5. Audit names/statuses/dates/currency values in all editor/detail/inner screens; maintain compact inline Back, read-only wallet, truthful status, client/account isolation and small reusable components.
6. Public Cloud website is a **separate repository** (`octalve-core/octalve-cloud`, 36 page.tsx source files at its inspected `main`), and its README still says phase-one placeholders and old `console.octalve.cloud` links. Actual live public policy routes 404; correct public repo/content separately after owner legal text approval.
7. `frontend/src/app/globals.css` is short in current source (52 lines). Old CSS retirement plans in historical docs must be treated as dated; do not run their old line counts as current release gates.
8. Standalone Invoice repo is a visual/reference implementation only. It is not Console invoice, price or transaction authority.

## 6. External dependency status

| Repository/service | Source snapshot reviewed | Operational outcome |
|---|---|---|
| Console frontend/API | `octalve-core/octalve-console`, `d7825d7e...` | Deployed and healthy at both aliases; customer-owner browser coverage incomplete |
| Public website | `octalve-core/octalve-cloud`, `779b08495...` | Live homepage reachable, but legally important policy routes 404 and public commerce remains unpopulated |
| OPanel | `octalve-core/octalve-opanel`, `543a01d30...` | Independent native/SSO scaffolding and tests; no verified real hosting/server/publication evidence |
| Invoice reference | `octalve-core/octalve-invoice`, `6bfa293eb...` | Reusable visual inspiration; not a backend authority |
| Neon | Live read-only database inspection | 59/111; zero published catalogue, zero suppliers; newest provider vault table absent |
| Paystack/Flutterwave | Source adapters only | No externally proven live end-to-end settlement in this audit |
| Brevo/Resend | Draft Integration Store registry and sender preferences | Real provider credentials/domain/receipts unverified, sending intentionally OFF |
| Registrar/DA/WHM/VPS | Supplier/registrar models and gated source | Not live certified; no externally confirmed account/registrar effect |

## 7. Prioritized delivery batches and acceptance gates

Each batch begins with exact current source/DB inspection; never repeat completed migrations. Use small feature-owned React modules and additive Django migrations. Every acceptance requires negative authorization tests, deployed exact SHA and independently verified state.

| Priority / ID | Deliverable | Acceptance evidence |
|---|---|---|
| **P0 / AUD-01** | Publish real company Terms/Privacy pages, align all signup links; correct unsupported public homepage claims and duplicate uptime tile | Live policy 200 and legally approved copy; accurate marketing / no unverified uptime guarantee |
| **P0 / AUD-02** | Provider vault DB migration preflight (current 59/111, exact subset), offsite backup + isolated restore, secure MFA/key custody gate | No unrelated migrations, WORM/step-up/rotation proof; provider tables + independent DB checkpoint |
| **P0 / AUD-03** | First real hosting supplier integration and published product/cycle/cost/markup | Supplier inventory fetched/authenticated, margins verified, one admin-published offer appears in API/public site, no invented prices |
| **P0 / AUD-04** | Complete Paystack financial sandbox and reconciled live qualification, Flutterwave separately | Signed webhook, independent provider verify, idempotency/refunds/chargeback, matching invoice and no duplicate settlement |
| **P0 / AUD-05** | Paid order→hosting provisioning→entitlement→OPanel signed SSO→public HTTPS website | One isolated owned account, replay-safe vendor receipt, live site and SSL/DNS verified, no cross-client access |
| **P0 / AUD-06** | Account email recovery and transactional Brevo setup with Resend separately | SPF/DKIM/DMARC, signed events, sender receipts, email consent and bounce suppression, low-volume delivery acceptance |
| **P0 / AUD-07** | Full object/action authorization, staff scoping and tenant denial, secure two-workspace roles | Least privilege, no staff cross-tenant leak, MFA changes, role revocation, regression and penetration test matrix |
| **P0 / AUD-08** | End-to-end invoice/tax/renewal and legal correctness | Region-effective tax quote and issue snapshots, accurate amount/currency/refunds, no retroactive invoice changes |
| **P1 / AUD-09** | Durable scheduler/worker and operational reconciliation | Restart/race/retry/dead-letter tests, no double charge/provision/email, job metrics and alerts |
| **P1 / AUD-10** | Authenticated 810-case browser and user journey parity | 135 × six widths signed role-scoped receipts with actual data and negative/error cases |
| **P1 / AUD-11** | Server-paged record directories, staff/team actions and inner-form consistency | Count/search/sort/filter on whole dataset, exact ID, role scopes, desktop/mobile validation |
| **P1 / AUD-12** | Domain registrar and customer DNS/renewal/transfer flows | Certified registrar sandbox, registry readback, ownership, expiry notifications, verified domain state |
| **P1 / AUD-13** | Backup/offsite and recovery practice, supplier outage rollback | Demonstrated restore, immutable audit receipts, RPO/RTO and incident exercise |
| **P1 / AUD-14** | Website and Console cross-repo route/content reconciliation | Canonical origins, links, SEO, versioned API and privacy correctness |
| **P2 / AUD-15** | Rewards, affiliate points, payouts and wallet deposit | Real verified financial ledger, rewards margin/anti-fraud, user consent and explicit financial go-live |
| **P2 / AUD-16** | Fully configured social login, additional providers, advanced internationalization | Approved OAuth proof, verified account linking, locale/RTL and user acceptance |

**Critical path:** AUD-01 + AUD-02 + AUD-07 security/compliance foundation; AUD-03 supplier/public offer; AUD-04 verified payment; AUD-05 provisioned hosting and SSO; AUD-06 recoverable customer communication; AUD-09/10 operational/browser acceptance; then expand to domains/rewards and extra products. Parallelize only independent source work; do not enable external writes merely to show a green UI.

## 8. Documentation audit and deletion policy

**Before cleanup:** 102 `docs/` files, plus the root README and backend README; review of all 102 paths/contents for obsolete guide references. Many dated batch reports intentionally preserve source decisions, migration evidence and security no-go requirements; keep them immutable as **historical snapshots**, even when counts/PR labels in those reports are no longer current.

**Verified obsolete and unreferenced in the other docs:**
- `docs/API_CONTRACT.md`: speculative old endpoint list, including generic PUT Settings endpoints that contradict live Django routes.
- `docs/FRONTEND_BACKEND_HANDOFF.md`: old pre-implementation handoff, wrong project structure/toolchain, obsolete hardcoded backend worklist.
- `docs/NEXT_PHASE_ROADMAP.md`: original eight-phase wishlist now overlaps and contradicts recent qualified gates.
- `docs/PROJECT_IMPLEMENTATION_GUIDE.md`: historical "mock data/backend to be built" instructions that misrepresent implemented Django/React authority.
- `docs/BACKEND_TOOLS_KB_CHECKOUT_CONTRACT.md`: malformed/truncated 299-byte skeleton ending in placeholder markers; no actionable or reliable contract.

These five should be removed from the current tree **only after** the new audit/index is committed. Git retains previous revisions for forensic history. Preserve existing dated `CLOUD_*` release/security/migration reports and UI-02/03 acceptance notes, but use this audit and `docs/README.md` for present-tense readiness. Update root/backend READMEs rather than leaving old "MVP skeleton" notices. Public and OPanel docs are owned by their independent repositories, not altered by this Console PR.

**Do not delete:** historical migration/incident recovery records, supplier security gate evidence, acceptance-test baselines, production rollback and DB identity research, or signed artefacts merely because their batch numbers are old. Deletion of audit/recovery evidence could cause operational harm.

## 9. Independent security and compliance references

- OWASP ASVS 5.0.0: https://asvs.owasp.org/ — system-wide access controls, sessions, authorization and anti-automation checks.
- OWASP OAuth 2.0 guidance: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html and RFC 9700 https://www.rfc-editor.org/rfc/rfc9700.html .
- ICANN Expired Registration Recovery Policy: https://www.icann.org/en/contracted-parties/consensus-policies/expired-registration-recovery-policy/expired-registration-recovery-policy-21-02-2024-en — approximately one-month and one-week expiry notices for covered gTLDs, plus post-expiry requirements.
- Paystack transaction and webhook authority: https://paystack.com/docs/payments/verify-payments/ ; https://paystack.com/docs/payments/webhooks/ .
- Brevo transactional email and domain verification: https://developers.brevo.com/docs/send-a-transactional-email ; https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC .

## 10. Audit limits and required sign-off

This audit inspected GitHub source, document contents, migration names, Vercel aliases, read-only Neon aggregates and anonymous live HTTP pages. **It did not** use a signed-in Super Admin/Staff/Client browser profile, run 810 authenticated cases, perform actual Paystack charges, create a server, register domains, send mail, obtain an offsite restore receipt, view secret credential values or independently evaluate legal advice. Any such claims require a new evidence record with exact source SHA, environment, role, result and reviewer. No Production tables, financial records, gateway configs or supplier credentials were modified by this documentation cleanup.
