# OCTALVE CLOUD — MASTER ACCEPTANCE MATRIX AND DELIVERY BACKLOG
**Date:** 26 October 2026 | **Release authority:** Review-only; all external PASS cells need real evidence
**Parent:** [Master execution plan](CLOUD_MASTER_EXECUTION_PLAN_2026-10-26.md)
**Operator:** update as the SAME issue/work proceeds, never mark PASS from an unrelated green CI job.

## Vocabulary and proof

- `CODE+CI` — implementation exists and automated/mock/disposable-DB checks passed; **not** equivalent to live provider acceptance.
- `REVIEW-PENDING` — external or deployed browser test has not been evidenced for exact current candidate.
- `BLOCKED` — missing credential, isolated environment, real domain/provider infrastructure, or an approved capability.
- `NOT BUILT` — no functioning end-to-end implementation.
- `PASS-EXTERNAL` — date, verified exact SHA, real scoped test system, redacted evidence ID and independent reviewer recorded.
- `PASS-PRODUCTION` — Production service smoke check on released SHA with actual monitoring; never inferred.
- A business event must show exactly one authoritative owner: payment/invoice (Console); domain registrar status (Console/registrar); hosting account/provider proof (Console/vendor); technical file/WordPress/dns access (OPanel under scoped Console entitlement).

## Minimum product: hosting using a customer-owned domain

| ID | Required behavior and test | Current evidence | Final acceptance requirement | Owner | Gate |
|---|---|---|---|---|---|
| I-01 | Unique Review database, separate OPanel DB and session store, no Production credentials | Code/docs only; missing branch-scoped API secret reported | Operator verifies target identities/backup/branch env without exposing secrets | Infra | 0 |
| I-02 | API/frontend/OPanel Review deployments all EXACT approved SHAs | CI green; no current-head browser deployment evidence | deployment IDs, SHA, URL, health and all relevant runtime configs recorded | Infra | 0 |
| I-03 | OPanel contract re-pin from old Console SHA | Exact candidate Console SHA re-pinned and contract CI passing at 26 Oct code check; re-pin after next Console changes | candidate SHA pinned and complete contract CI rerun | Both | 0 |
| I-04 | No extra Vercel builds due to unrelated PR commits | Wildcard phase builds suppressed in existing vercel.json | Explicit deployment window, build count/quota check, no bypass merge | Infra | 0 |
| C-01 | Published vendor-backed retail hosting plan, cost floor, markup/discount, cycle, supplier package | CODE+CI PR #13 | actual test supplier plan and price map validated | Console | 1 |
| C-02 | Exactly one order and unpaid invoice for an idempotent checkout | CODE+CI | real Review browser duplicate checkout/foreign-user tests | Console | 2 |
| P-01 | Hosted test checkout uses server amount/ref and fixed callback | CODE+CI, flags OFF | approved gateway test-key HTTP response, test-only credential, HTTPS/redirect checks | Console | 2 |
| P-02 | Signed webhook minimal inbox and one reference | CODE+CI, flags OFF | authentic test webhook, signature refusal, duplicate/late event | Console | 2 |
| P-03 | Independent API readback matches reference, amount, currency, provider status | CODE+CI | authentic sandbox response; no test-mode settlement into financial authority | Console | 2 |
| P-04 | Actual live-money gateway settlement, refunds/disputes/overpayment reconciled | CODE+CI for core transaction | *Before selling live*: authorized merchant live test, ledger reconciliation, chargeback/refund SOP | Console | 5 |
| P-05 | Wallet invoice pay does not debit outside trusted ledger | Prior unsafe shortcut disabled (CODE) | regression refusal; do not re-enable until atomic ledger acceptance | Console | 5 |
| H-01 | Invoice/provider-approved paid order stages one task/account | CODE+CI | attempt/replay cases; one task per paid item; no fake paid provider result | Console | 1 |
| H-02 | Durable create attempt reservation survives restart, no blind retry | CODE+CI (no network request) | genuine timeout/drop response test, DB persisted ambiguous state, one remote command maximum | Console | 1 |
| H-03 | Controlled DirectAdmin/WHM create on authorized server | Only request contract, NOT BUILT | exact actual API version/package/username/credentials plus single create proof | Console | 1 |
| H-04 | Exact vendor readback, suspended/owner/domain/account/package refusal | CODE+CI, no live provider | remote existing account confirmed by scoped read-only GET; another reseller denied | Console | 1 |
| H-05 | Billing period begins on actual provider activation; wrong state cannot authorize OPanel | CODE+CI | real domain/account/clock evidence and correct term | Console | 1 |
| S-01 | Single-use Console → independent OPanel SSO | CODE+CI; older cross-repo contract pin | two deployed product browser end-to-end, PKCE replay/referrer/callback tests | Both | 3 |
| S-02 | Session expires/revokes on suspension/expiry/ownership change | CODE+CI | real cross-tenant tests, revoked binding, credential rotation, Console outage | Both | 3 |
| S-03 | OPanel management capability per operation (not overview wildcard) | Management boundary CODE+CI; grant only `overview` | durable audit, policy and vendor account authorization for each op; no browser provider keys | OPanel | 3 |
| W-01 | Own-domain DNS points to test provider account | OPanel DNS/zone connection checklist and deny-by-default record preview CODE+CI; no live zone | authoritative DNS A/AAAA/NS resolution and account IP confirmation | Both | 3 |
| W-02 | Safe static website upload/publish to correct document root | ZIP upload UI + entitled inspection API + disposable native first-publication CODE+CI; real provider publish absent | real file upload with path traversal/symlink/ZIP size checks, atomic publish and HTTP response | OPanel | 3 |
| W-03 | WordPress install with separate scoped database and admin | Runtime/installer preflight CODE+CI; actual installation NOT BUILT | actual provider-supported installer/test install, correct WordPress admin and HTTPS | OPanel | 3 |
| W-04 | SSL issuance, renewal and HTTPS works | NOT BUILT end-to-end | trusted public certificate on test domain, redirect/certificate-expiry monitor | OPanel | 3 |
| M-01 | Order, payment, hosting-ready and site-live emails | NOT BUILT/verified end-to-end | idempotent delivery + bounce/retry/audit, no plaintext account password | Console | 2–3 |
| M-02 | Renewal/suspension/grace period/missed payment | Existing states only; lifecycle not qualified | timed clock tests, provider suspension/reversal, customer notices, support path | Console | 5 |
| R-01 | Review exact SHAs with CI and external acceptance | CODE+CI only | signed matrix, no critical test failure, E2E recordings redacted | Both | 5 |
| R-02 | Production target/migration preflight, backup and controlled go-live | Not executed in latest batch | independent approver, production DB identity/ledger, expand-only migration, rollback | Release | 5 |
| R-03 | Real site live, customer can manage and revoke service | NOT BUILT end-to-end | site served with valid HTTPS on owned domain and owner scoped in OPanel | Both | 5 |

## Optional but separately gated domain-registration stream

| ID | Behavior | Current state | External gate |
|---|---|---|---|
| D-01 | Live registrar availability, TLD conditions and actual currency price | Supplier-quote validity/expiry contract CODE+CI; real registrar search still 503 | authorized registrar sandbox, no fabricated availability |
| D-02 | Supplier cost vs customer price, retail margin, promo/discount approval, renewal prices | Supplier-cost/retail discount guard CODE+CI; no live registrar price yet | validated TLD registration/renewal costs and markup ledger |
| D-03 | Registrar-confirmed registration and verified contact | NOT BUILT | registrar result ID, expiration/ownership/ICANN-specific verification |
| D-04 | Nameserver setup and DNS zone authority | NOT BUILT | authoritative registrar/hosting DNS separate ownership checks |
| D-05 | Renewal, transfer EPP, domain expiry and failed registration exception | NOT BUILT | TLD policy/sandbox transitions and protected EPP handling |
| D-06 | Customer sees domain REGISTERED only after external truth | NOT BUILT | mismatch/retry tests; no paid invoice alone grants domain rights |

**No-go:** Domain sales must stay hidden/disabled until D-01–D-06 have evidence. Hosting-only first launch can use an already-owned domain if minimum hosting gates pass.

## Provider/API failure adversarial test matrix

| Failure case | Expected persisted outcome | Never permitted |
|---|---|---|
| Payment redirect says success; gateway says pending | Unpaid invoice + no hosting | Activate |
| Signed webhook replay | One inbox event, financial state unchanged until independent verify | Duplicate settlement |
| Provider gateway verifies over/under payment | Exception review, no full settlement | Silent adjust |
| Gateway sandbox reports success | Sandbox evidence only; no Production payment truth | Activate real service |
| Create request timed out after sending | Attempt `unknown` + vendor read-back/manual review | Retry provider create |
| Task reservation made but worker never dispatched | `reserved_no_network` or explicit canceled-before-send; no paid hosting activation | Report customer "ready" |
| Remote account exists under wrong reseller/customer | Refuse bind, audit security event | Grant OPanel |
| Provider returns 200 but user suspended | Remain pending/revoked | Activate |
| Domain invoice paid but registrar registration fails | Separate domain exception and recovery/refund | Report domain registered |
| DNS changed to wrong IP | Website status not-live, alert customer/operator | Claim site published |
| Wrong filesystem root/symlink attempted | Forbidden, audit (no write) | Read/write other customer |
| OPanel SSO reused/expired/wrong callback | Denied, no session | Impersonate |
| Console unreachable mid-operation | Fail closed, log bounded error | Stale technical mutation |
| Preview points to Production DB | Hard stop; block startup/execution | Perform schema migration |
| Vercel preview build-rate limit | No deploy; queue manual reviewed candidate | Merge unqualified to main |

## Batch sign-off record (populate on actual execution)

| Batch | Code SHA (Console + OPanel) | Evidence (job/deployment/test provider) | Owner review | External gate | Decision |
|---|---|---|---|---|---|
| 0 Review infrastructure | pending re-pin | pending | pending | blocked until isolated env | NOT APPROVED |
| 1 Real provider-hosting account | pending | synthetic only | pending | no approved server | NOT APPROVED |
| 2 Gateway sandbox and customer notifications | pending | synthetic only | pending | no provider test credentials/delivery | NOT APPROVED |
| 3 OPanel live static/WordPress/HTTPS | pending | local/module CI only | pending | actual node/provider and domain | NOT APPROVED |
| 4 Registrar domain commerce | pending | domain endpoints fail closed | pending | registrar integration absent | NOT APPROVED |
| 5 Production release | pending | no exact full browser gate | pending | all minimum gates | NOT APPROVED |

## Required final-release evidence manifest

```text
release_candidate:
  console_commit: <full 40-character SHA>
  opanel_commit: <full 40-character SHA>
  catalog_pr: 13
  console_pr: 14
  opanel_pr: 1
  review_targets: <non-secret hostnames and deployment IDs>
  review_db_fingerprint: <non-secret project/branch/database name, NOT URI>
  provider_test_system: <non-secret test account + vendor version + domain>
  payment_test_system: <sandbox event/transaction IDs only, NEVER live card data>
  ci_runs: <GitHub Actions run IDs and conclusion>
  browser_tests: <run ID + redacted video/log artifact>
  real_site: <owned disposable domain and exact expected content>
  security_review: <approved reviewer/date>
  db_migration_preflight: <DB identity, backup checkpoint, ledger difference>
  production_staged_deployments: <target IDs>
  feature_switches: <audited enabled/disabled list, never secrets>
  rollback_checkpoint: <previous deployment IDs and safe DB recovery>
  owner_approval: <approved after all required gates>
```

**Cross-reference:** [Master plan](CLOUD_MASTER_EXECUTION_PLAN_2026-10-26.md), [Production runbook](CLOUD_PRODUCTION_RELEASE_RUNBOOK_2026-10-26.md), and earlier `CLOUD_RELEASE_AUDIT_AND_RECOVERY_2026-10-26.md`.
## Batch 3/4 evidence addendum — 26 October 2026

- OPanel native first-publication, static ZIP inspection, wrong-service, zip-slip/symlink/bomb checks, mobile upload and separated workspace components: **CODE+CI ONLY**. No real provider account received a customer file and no public site was brought online.
- OPanel WordPress/Softaculous, GitHub selected repository and Cloudflare zone: **eligibility/preflight CODE+CI**. No app token, provider installer, registrar, DNS mutation, deployment or external website proof.
- Console domain registrar quoting: **immutable supplier-rate/freshness and margin contract CODE+CI**. The real domain availability/purchase endpoints remain fail-closed until authorized registrar API and fulfillment exist.
- Manual upload is available as a visible UI path independently of GitHub. Validation is separately feature-gated; customer Publish stays blocked until account-bound remote adapter and versioned release/rollback are accepted.
- Reference OPanel [Batch 3+4 execution detail](https://github.com/octalve-core/octalve-opanel/blob/docs/independent-foundation-design/docs/OPANEL_BATCH_3_4_STATIC_UPLOAD_AND_CONNECTORS_2026-10-26.md) and Console [Batch3+4 cross-product ledger](CLOUD_BATCH3_4_UPLOAD_DOMAIN_AND_RELEASE_2026-10-26.md).
- Go-live remains **NOT APPROVED** until isolated Review with authorized external provider, real owned-domain/HTTPS website, proper DNS/registrar and customer-facing operational acceptance, plus Production preflight and owner authorization.

## File Manager and customer truth gates — 26 October, next Review batch

| Gate | Implementation | Release evidence still required |
|---|---|---|
| FM-01 | OPanel modular tree/table/breadcrumb/details UI and manually selected **example preview** | Real account-scoped file inventory against an authorized server; do not infer sample paths are real |
| FM-02 | `GET /api/files/list/` requires current authorized session; verified worker resolver intentionally returns 503 until wired | Independent `files.list` grant from Console and confidential resolver to exact provider/node/account |
| FM-03 | Server-side relative directory/path, metadata and duplicate checks; synthetic native-worker directory listing tests | Provider-specific enumeration, safe symlink/absolute path isolation, timestamp/source proof, live audit and revocation |
| FM-04 | Website ZIP inspect and local first-site publication on disposable filesystem | Secure account-scoped remote publish, rollout/rollback, real hostname DNS/TLS/HTTP content proof |
| CUX-01 | Console status uses fresh provider binding for `hosting_account_verified`, explicitly DNS/site `unverified` | Actual provider proof, domain verification, website readiness measurements |
| CUX-02 | Generic client detail no longer substitutes arbitrary demo records when live API does not return object | Browser regression for missing/other-owner domains, invoices and hosting services |
| UI-01 | Separate components, CSS and CI modularity guard rather than monolithic pages | Final Playwright/Next.js CI on exact SHA and deployed 360px/desktop browser review |

See [separate customer flows and execution state](CLOUD_CONSOLE_OPANEL_USER_FLOWS_AND_FILE_MANAGER_2026-10-26.md) and [OPanel File Manager implementation](https://github.com/octalve-core/octalve-opanel/blob/docs/independent-foundation-design/docs/OPANEL_FILE_MANAGER_UI_AND_LIVE_AUTHORITY_2026-10-26.md).

**PRODUCTION REMAINS NO-GO.** Do not check any live/provider/registrar/payment/site gate based on sample folder tree, mock authenticated session, local filesystem worker or CI alone.
