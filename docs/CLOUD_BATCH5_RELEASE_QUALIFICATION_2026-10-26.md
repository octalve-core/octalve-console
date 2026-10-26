# Octalve Cloud — Batch 5 release qualification and acceptance
**Date:** 2026-10-26
**Stage:** REVIEW ONLY — NO-GO for Production merge/auto-deployment.
**Sources:** existing `review/cloud` and independent OPanel draft PR #1.
**UI decision:** Octalve Invoice-inspired, existing Console brand; no copied competitor assets.
**Owner decision:** all five batches consolidated, then only merge on verified release gates.

## 1. What is qualified by automated evidence

- GitHub Actions **Cloud C1 backend security checks** covers dependency audit, frontend TypeScript/build, Django system/security/migration checks, named finance/auth/support/knowledge/OPanel negative tests, and the historical baseline guard.
- **Cloud auth schema — disposable PostgreSQL acceptance** confirms a *synthetic disposable database* can reach 54 migration records and 100 expected public tables. It does **not** confirm the identity, ledger, prior state, data or backup of the real Cloud Production DB.
- Batch 5 fixes stale Staff ticket access after department/skill removal, filters outbound notification recipients by current authorization, and replaces a customer detail-page manual Refresh button with bounded visible-tab auto-sync.
- This record does **not** represent real browser, email delivery, payment, registrar, VPS, provider-provisioning, live OPanel, DNS, SSL or site-content acceptance.

## 2. Current evidence (recheck every item at merge time)

| Gate | Status | Evidence and limit |
| --- | --- | --- |
| Review code and automated Django/frontend/security | PASS on exact CI SHA only | Link runs from GitHub PR checks; rerun after any new commit |
| Disposable PostgreSQL migrations | PASS on exact CI SHA only | 54 / 100; synthetic, not Production |
| Account profile, password and email negative tests | PASS, isolated | Real verified SMTP provider and mailbox delivery NOT checked |
| Server-priced checkout, coupons, unpaid invoices, PDF | PASS, isolated | No real registrar, order payment or gateway settlement |
| Hosted checkout and webhook authority | NOT QUALIFIED | Provider sandbox signed callback and independent readback missing |
| Live supplier-backed hosting and OPanel session | NOT QUALIFIED | OPanel PR remains draft, source contract pins older Console revision |
| Readiness, website publication, DNS and SSL | NOT QUALIFIED | No controlled server, owned domain, HTTPS/content proof |
| Customer, Staff, Admin support routing and knowledge editing | PASS, isolated tests | Multi-role live browser/keyboard/mobile QA and mail transport missing |
| Cloud Production DB target, migration ledger, backup and recovery | BLOCKED | Connected Neon only exposes Octalve Vault; never use it as Cloud |
| Review URL pair plus isolated Preview secrets and DB | BLOCKED | Current Git integration does not deploy Review automatically |
| Production Vercel release containment and rollback | BLOCKED | Both vercel.json files enable deployment on main; no staged containment verified |
| Production frontend/backend parity | PASS for existing deployment only | Both public aliases currently reference main a4585e21, prior release |
| Release sign-off | NOT READY | Blockers above must pass before main merge |

## 3. Mandatory real user journeys — complete, not step-skipped

Each journey requires an actual browser transcript at desktop (1440x900), tablet (768x1024), and mobile (390x844) using isolated Review infrastructure. Record date, tester, accounts, exact frontend/API commits, Review DB identity and non-sensitive screenshots. No real customer money or hosting mutations.

### A — Anonymous, account and authentication
1. Open homepage/login/signup and password reset, inspect mobile overflow/keyboard focus/contrast.
2. Register synthetic customer; verify email **only through delivered provider mail** with correct expiry, replay denial, wrong-account denial and opaque error messages.
3. Sign in; reload; confirm session recovery; log out; back-button must not restore private state.
4. Reset password with single-use token; old password and expired/replayed tokens fail; rate limiting prevents enumeration.
5. Test unauthenticated GET/POST to customer/Admin/Staff resources; all must reject. Check CSRF/origin for state-changing BFF requests.

### B — Billing/contact/profile
1. Enter legal name, phone, country, state, address, postal code and tax ID; save and sign back in to verify persistence.
2. Attempt PATCH `role`, email verification, other user ID, account credit and customer pricing from browser; all denied.
3. View checkout with saved contact/billing snapshot; edit profile then ensure already issued invoice is immutable.

### C — Hosting discovery and cart
1. Visit catalog; only provider-qualified active/public published plans with correctly attributed prices appear.
2. Compare plan billing terms; validate renewal disclosure, currency, discount, empty catalog, stale offer revision and mobile cards.
3. Choose hosting and existing owned domain/connect later; new registrar purchase stays blocked without registrar authority.
4. Apply valid/expired/wrong-product coupon. Quote must not create order, invoice or gateway transaction.
5. Confirm exactly once and retry same checkout key; exactly one order + one unpaid invoice; a changed cart requires new key.
6. Verify invoice download remains unpaid, pending state is truthful, no fake paid receipt and no unexpected service provisioning.

### D — Money and provisioning (isolated external sandbox ONLY)
1. Separate test gateway account, verified merchant identity, signed webhook, correct amount/currency and provider reference.
2. Repeated/out-of-order/invalid callbacks must not double-settle. Browser return URL is not payment truth.
3. Provider timeout and uncertain remote create must hold in exception state, no blind second create.
4. Verify exact reseller inventory/service ownership, single authenticated server account creation and independent readback.
5. Suspend/expire/refund service; Console entitlement and OPanel SSO must revoke appropriately.
6. Verify customer-owned disposable domain, authoritative DNS, TLS certificate, expected content over public HTTPS.
7. Do not activate real hosting or public checkout without the above proof.

### E — Console ↔ OPanel
1. Pin final Console Review issuer SHA in OPanel contract workflow; run all three OPanel suites against this exact version.
2. Console authenticates and checks paid/active/owned/verified account before issuing one-time code.
3. OPanel exchanges code server-to-server and establishes its independent scoped session.
4. Test code expiry/replay, wrong tenant, no customer role, no service, suspended/expired account, callback/origin mismatch, revoked session and backend outage.
5. Verify OPanel's File Manager, DNS, SSL, email and backups remain unavailable unless their individually qualified server capability is present.

### F — Support and knowledge base
1. Admin creates Technical and Billing departments and DNS, SSL, Email topics; assigns Staff to department then topic.
2. Customer opens DNS ticket: only matching eligible agent receives assignment; no specialist means unassigned department queue.
3. Remove an agent's DNS tag/dept during a live ticket: access and notifications revoke immediately even with stale assigned_to.
4. Staff sees authorized inbox only; other-customer ticket IDs, draft/internal notes and staff-only article drafts are denied.
5. Customer replies, Staff replies, Admin reassigns, resolve/close/reopen; check status and message chronology.
6. Staff drafts article with heading/list/link, previews and saves. Publication by unauthorized Staff is denied; Admin publishes; customer sees only published client-visible guide.
7. Review KB readability, search, filter, empty/error state, keyboard navigation, mobile width and text contrast.
8. Confirm ticket alert mail only when correct private transport is configured; file attachment support remains disabled until private malware-scanned storage is approved.

### G — Admin/Staff and failure/recovery
1. Verify least-privilege Admin, Staff and Customer navigation; no direct URL/API privilege escalation.
2. Exercise catalog management, provider/offer revisions, billing readback, provisioning queue and exception lifecycle without external writes.
3. Simulate API timeout, cancelled request, gateway outage, stale browser and offline return; never show synthetic account credit or paid state.
4. Confirm server logs redact tokens, email links, passwords, webhook secrets, credentials and private provider identifiers.
5. Verify deploy cold start, frontend/API parity, predictable HTTP errors, accessibility and responsiveness.
6. Confirm rollback procedure against preserved prior Vercel deployment IDs and forward-compatible DB migration checkpoint.

## 4. Protected Production release — hard requirements

1. Verify the **actual Cloud Neon project, database name, branch ID, TLS endpoint identity, migration ledger, backup ID and restoration test**. Never use the visible Octalve Vault project.
2. Compare *actual* pending migrations by name, SQL effects and existing data. Confirm the 49 legacy snapshot rather than trusting it. Back up and apply only qualified migrations, following expand/contract compatibility where appropriate.
3. Obtain isolated real HTTP browser acceptance against the exact Review code pair; retain authorized accounts/evidence. Review auto-deploy is disabled; validate scoped Review secrets before creating one deployment.
4. Confirm OPanel own PR/contract HEAD and no concurrent Work updates; only merge OPanel independently after its gated acceptance. No need to buy unused VPS ahead of readiness.
5. Prevent Vercel main-branch merge from automatically deploying/assigning a breaking API. Confirm project-level git deployment behavior, staged build strategy and old-good rollback aliases.
6. Approve release-scope flags individually; unaudited gateway, registrar, provisioning, remote file writes and OPanel technical operations stay OFF.
7. Merge `review/cloud` into `main` **only after gates 1–6** are independently evidenced. Pin expected PR SHA and protect against branch drift. Verify both resulting Production aliases and records.

## 5. Hard stop / safety properties

- Any failed/unknown critical gate => **NO-GO**; do not merge to `main`, migrate Production, start a charge or provision a server.
- No copied passwords, tokens, API keys, personal payment details or backup credentials in screenshots, Git, release docs or chat.
- Protect customer data: per-object tenant authorization, API write authority, short-lived SSO and audit. Review synthetic test records only.
- Never equate a CI-green release candidate with actual customer-deliverable hosting.
- Retain exactly the intended two long-lived Console branches: `main` and `review/cloud`. PRs do not require a third branch.
