# Octalve Cloud Console — Consolidated Batch E1–E6 review and release gate
Date: 2026-10-28. Base: main 9723f0c2aec4eaff0d0c2f3c17c2c37f71af10bb. This PR is source qualification only, **not** a Production deployment or live vendor activation.

## E1 — Canonical, truthful readiness
- Added a checked JSON manifest for all **135 actual Next.js pages** (Admin 85, Client 33, Staff 10, Public/Auth 7). Six breakpoints create exactly **810 required browser cases**, zero of which are certified by this source manifest.
- Readiness checklist no longer claims any of eleven static policy descriptions are operational evidence. Dashboard differentiates source inventory, selected navigation entries, unavailable external gates and pending acceptance.
- Runtime public URL validation checks HTTPS, no credentials/hash/query, expected API /api path and production mode. These are syntactic checks only, not live health/DB queries.
- No successful Github workflow proves 810 browser screenshots or supplier certification.

## E2 — One Catalogue pricing authority
- Generic Products/Plans create and edit screens are blocked, including direct legacy editor routes. Products and Plans lists link to **Catalogue Workbench** for category/product identity and supplier-backed offer drafts. No unauthorized plan API create/patch survives the UI.
- Componentized the Product/Category step. Catalogue list loader refuses malformed API envelopes instead of silently displaying a false empty catalogue.
- Commercial authority stays in Django `catalog/offer_management.py`, which checks supplier health, verified inventory, resource limits, wholesale cost constraints and publishes immutable offer revisions. Provider credential custody stays in Integrations, not Products.

## E3 — Source-inspected API contract inventory
- All 44 selected endpoints across 11 groups now carry source-inspected **expected** and **observed** outcomes. No record asserts successful authenticated Production HTTP interaction.
- Manual source statuses distinguish Source mapped, Requires qualification and Policy blocked. Direct invoice/domain/service/provider/task creation must not show as aligned when Django explicitly refuses its unqualified write.
- This is an inventoried subset, not discovery and qualification of every Django router action. Remaining endpoints must be enumerated from resolved Django URL patterns and exercised in isolated tests with Client/Staff/Admin identities, including 401/403/404/409/503 and BFF boundaries.

## E4 — No unversioned hosting checkout
- `CreateOrderSerializer.validate_items()` refuses any hosting/WordPress/VPS plan without a `PublishedCatalogOffer` revision before creating an order/invoice. No transitional customer checkout bypass is permitted.
- Published versions must also match billing-cycle price/setup fee/currency and supplier package mapping, health and cost policies, as previously implemented.
- New regression tests assert both quote and order endpoints reject an unpublished active plan without creating financial documents.
- Important: older BIZ-01/B2 tests intentionally used unversioned fixtures. Those must be upgraded to published, supplier-backed synthetic fixtures, **never** addressed by opening a Production unversioned checkout exception.

## E5 — Genuine 810-case browser acceptance (not complete)
- The existing `browser-parity-qualification.cjs --plan ...` generates source-derived role/viewport tasks and its signed-evidence verifier rejects absent evidence. The new canonical manifest enforces route parity in CI.
- Required: authenticated role-correct Admin/Client/Staff sessions, valid synthetic dynamic-ID fixtures, six screenshots per page, keyboard navigation, responsive layout, no overflow, truthful account data and independently signed reviewer attestation.
- Without credentials and a complete artifact set there are **zero new signed browser acceptances**. Do not fabricate evidence or present the GitHub build as acceptance.

## E6 — Independent operational acceptance (not complete)
- Added `python manage.py inspect_cloud_release --json`: explicit **read-only** database `SELECT 1`, Django migration parity and a count of public active hosting plans lacking a publication revision. It reports redacted, machine-readable statuses, not connection strings or secrets; external certification is always false.
- Run against a verified, authorized Production DB only in a controlled read-only operator session. CI may run on disposable databases; CI results cannot certify Production.
- Do not accept payment gateway activation without real invoice-backed reconciliation/webhook/callback tests and independent approval.
- Do not accept DirectAdmin/WHM/cPanel egress or provisioning without independently approved network controls, adapter certification, vendor acknowledgement and recovery.
- Genuine WebAuthn, KMS custody, externally immutable WORM backups and isolated actual restore still have their own certificates and owner sign-offs.

## Verification
- `node frontend/scripts/check-batch-e-authority.cjs` checks 135 canonical routes, 810 pending cases, truthful 44 API inventory, immutable unversioned checkout guard and Catalogue link authority.
- `python manage.py test orders.test_published_checkout_gate` creates synthetic records only.
- Exact-head Frontend TypeScript/Next build, Django full API regressions, security and disposable PostgreSQL suites must pass. Do not merge merely because a CI job is launched.

## Pre-existing and outstanding external blockers
- Legacy `globals.css` remains until full visual parity is signed.
- Do not call a source-registry entry an endpoint tested.
- Do not certify the database from `/api/health/` liveness.
- Zero signed 810-case evidence in this PR.
- No independent Production DB recovery, supplier connectivity, gateway settlement or KMS/WORM certification.
- Production Vercel auto-Git deploy remains disabled; keep money movement, provider credential writes, domain registration and unsafe provisioning disabled.

## Standards and research
- OWASP API Security Top 10: https://api-security.owasp.org/
- Django deployment checklist (`check --deploy` limitations): https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/
- Django database system checks: https://docs.djangoproject.com/en/5.2/ref/checks/
- Django transactions: https://docs.djangoproject.com/en/5.2/topics/db/transactions/
- W3C WebAuthn: https://www.w3.org/TR/webauthn-3/

## Release decision
Source-only draft; require exact-head CI and independent follow-up browser/Production attestations. Do NOT claim full E5 or E6 qualification, and do NOT deploy or activate Production financial/supplier capabilities as a side effect of this source update.
