# Octalve Cloud — Batch 3/4 Execution and Cross-Product Release Ledger
**26 October 2026 · Review-only implementation ledger**
**Console:** PR #14 stacked on #13
**Independent OPanel:** PR #1
**OPanel execution detail:** https://github.com/octalve-core/octalve-opanel/blob/docs/independent-foundation-design/docs/OPANEL_BATCH_3_4_STATIC_UPLOAD_AND_CONNECTORS_2026-10-26.md

## Owner-approved product direction

1. **Manual website upload is mandatory**, independently available from OPanel Websites and File Manager. GitHub deployment is an alternative source, never a replacement. Start with prebuilt static HTML/CSS/JS; only advertise WordPress/Node/Next.js when the exact hosting provider package proves support.
2. **Two entry paths:** preferred Console → OPanel PKCE SSO; optional independent technical OPanel account (hashed in OPanel, enrolled through proven Console SSO, rechecks Console entitlement on every access). The technical username is not the DirectAdmin/WHM hosting account or WordPress login. Approved in design; public feature remains OFF until security/browser gates.
3. **Integrations:** WordPress/Softaculous, Cloudflare zone DNS, and GitHub static deploy live under OPanel Integrations, independent adapters with own credentials/scope/rollbacks. Additional integrations should be added as separate components and capabilities.
4. **Maintainability:** lean route/page shells, components and server-side adapters split into independent modules. Avoid thousand-line pages and single giant action handlers. Separate UI data registries from presentation and mutation authorities.

## Implemented in Batch 3

- OPanel upload ZIP selector plus server-side CSRF-and-entitlement-protected inspection endpoint; bounds path traversal, unsafe content, ZIP bombs, symlinks, name collisions, file limits and root index.html. Inspect-only capability can be enabled separately in isolated Review; customer Publish still blocked until actual hosting worker is qualified.
- OPanel native worker first static publication on an approved disposable local account root, single first site only, staged with bounded files and SHA checking; tests prove wrong service, symlink, re-publish denied and no overwrite. This is **not vendor-backed remote publication or a public hosting website**.
- Independently scoped GitHub selected-repo immutable commit and artifact preview; WordPress supported runtime+installer proof preview; both no-network.
- OPanel frontend split into shell, components, integration catalog/cards, Upload, DomainConnection, and isolated CSS. Django technical views and upload inspection views split from PKCE session authority. Unit, API and Playwright mobile tests extended.

## Implemented in Batch 4 (contract-level only)

- `backend/domains/registrar_quote.py` validates registrar-backed availability evidence with source, domain/TLD/period/currency, supplier reference, <=15-minute TTL, supplier cost and approved retail markup/discount floor. Real registrar execution and nameserver update **always raise** until qualified adapter is installed.
- `backend/domains/test_registrar_quote.py` covers invalid/stale availability, price undercut, wrong TLD, unsupported currency and no registrar-side mutation. Included in Console C1 CI.
- OPanel Cloudflare DNS change preview validates separately verified zone ID and ownership, correct domain scope, A/AAAA public IP, CNAME/TXT validity, TTL and current `dns.zone.write` grant. The integration and UI remain disabled: no actual zone authority or Cloudflare credential is connected.
- OPanel DomainConnection screen surfaces the actual service domain and an explicit **DNS not verified** state, with connection checklist. No fake registrar confirmation, DNS success or SSL issuance.

## Remaining external execution gates

| Gate | Evidence required | Why not yet complete |
|---|---|---|
| Actual vendor hosting account create | Authorized DA/WHM reseller, package, test account, exact readback and no retries | No verified vendor/test credentials |
| Provider-scoped file publish | Reviewed vendor file API or hardened native node with account OS isolation, durable job/release generations and egress | Not yet deployed |
| Actual domain registrar | Authorized sandbox/registrar, TLD requirements, real availability/registration/renewal/exception ID | No approved registrar |
| GitHub deploy | GitHub App installation with selected repo read access, immutable commit and trusted build artifact, scoped publish | App/token/runner not configured |
| WordPress installation | Proven PHP, database and official supported installer with customer admin setup | Supplier package/installer not qualified |
| Cloudflare DNS / SSL | Customer zone ownership, scoped API token and DNS+certificate confirmation | No zone credentials or approved API execution |
| Public website confirmation | Test-owned domain DNS -> provider IP, valid HTTPS and expected content body | No real test website hosted through Octalve |
| Production | Controlled exact CI/Review/browser, DB preflight, rollback and owner approval | Required external acceptance pending |

**No Production action in this batch.** Console migration baseline remains the existing Review 52/97 schema proposal, and OPanel's independent technical-login migration remains unpromoted. No new Console migration was added in Batch 4.

## Suggested next release candidate

Use an existing owned test domain/subdomain and authorized disposable provider account. Finish one upload **actually published** and verified over HTTPS before enabling hosting sales. In parallel connect registrar sandbox, scoped GitHub App and Cloudflare test zone when credential owners supply access. Keep domain sales and unqualified connectors disabled until respective external gates pass.

Full roadmap: [Cloud master execution](CLOUD_MASTER_EXECUTION_PLAN_2026-10-26.md), [acceptance matrix](CLOUD_MASTER_ACCEPTANCE_MATRIX_2026-10-26.md), [production runbook](CLOUD_PRODUCTION_RELEASE_RUNBOOK_2026-10-26.md).
