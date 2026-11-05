# Octalve Cloud INT-03 — DNS verification, registrar quotations and purchase-release gates

**Dated:** 2026-11-05  
**Source authority:** `octalve-core/octalve-console` main after reviewed INT-02.  
**Safety:** No domain registration, payment, DNS mutation, registrar renewal, transfer, or nameserver change is authorized merely by this source release. Do not infer a live supplier connection from synthetic CI tests.

## Verified state before this batch

- Production Neon provider-vault tables had **zero credential versions** and **zero provider connections**; Super Admin vault TOTP enrollment was verified.
- Vercel Production API project had the five key variable names plus owner custody/step-up/write approval variables, but **protected variable values are not readable**, so presence cannot prove the current values, an external key backup, or an approved change window.
- Existing `domains.views` customer-facing DNS create/update/delete and domain registration/transfer/renewal endpoints explicitly deny execution. Keep them fail-closed.
- Existing INT-01 Cloudflare DNS readback can verify active account/zone ownership and a bounded record digest. INT-03 changes it to use **exact zone details and complete, bounded DNS pagination** rather than treating the first list page as the whole zone.
- Legacy adapter `test_connection()` that returned `ok=True` without authenticating is now denied.
- Cloudflare published **Registrar API beta** with live `POST /accounts/{account_id}/registrar/domain-check` for registry availability and cost, and a separate billable `POST /accounts/{account_id}/registrar/registrations`. This release implements the former ONLY; no live registration code.
- Cloudflare Registrar domains require Cloudflare nameservers, and the beta API supports only documented extensions. Registrar writes may immediately charge the account default payment method, and completed registrations cannot be refunded.

## INT-03 source safety gates

### D1 — Cloudflare DNS read-only certification

- Separate Cloudflare DNS token scoped to the exact approved zone with `Zone Read` and `DNS Read`. Never reuse the Registrar or full-account token.
- Create encrypted `cloudflare-dns` connection via Console only after credentials, external custody, operator approval, database immutability and MFA are independently qualified.
- Verify with the existing authorized Console action (password + new TOTP, never an unverified proxy). The connector makes only authenticated fixed-origin Cloudflare `GET /zones/{zone_id}` and `GET /zones/{zone_id}/dns_records?page=N&per_page=100`.
- Require **active zone**, exact account ID, strict response shape, complete paging, bounded 1,000-record maximum, no duplicate record IDs and a retained nonsecret audit receipt. A zone with more than the bound fails closed pending reviewed controlled pagination extension. DNS content is only used for digest and is not exposed in the browser.
- No records are created, edited, deleted, bulk-imported or synced into a customer domain during readback.
- Planned DNS mutation requires a separate reviewed batch: exact resource-bound update plan, expected previous record ID/content digest/version, concurrent change detection, role and customer ownership, audit before/after, DNSSEC/MX/TXT/CAA safeguards, least-privilege dedicated write token, operator approval and rollback plan. **Do not enable DNS Write just to test readback.**

### D2 — Cloudflare Registrar sandbox

- Keep `cloudflare-registrar` sandbox credential schema independent from live `cloudflare-registrar-live` schema. Do not upgrade/reuse old sandbox token implicitly.
- Sandbox simulation remains isolated and never emits a paid registration, Django `Domain`, invoice or entitlement.

### D3 — Live registrar quote only

- Cloudflare's live quote endpoint is `POST /accounts/{id}/registrar/domain-check` with `{"domains":["candidate.com"]}`; this is an availability/price lookup, **not** the registrations endpoint.
- Use a **separate** Cloudflare Registrar account-bound API token stored as an encrypted `cloudflare-registrar-live` draft in the provider vault. Consult the account's current API permission selector; Cloudflare's beta documentation lists Registrar permissions for API use. If the permission necessary for checking also allows registration, the backend path allowlist and explicit review gates must remain in place; a token scope is not a substitute for operation-level controls.
- Quotes are initially allowed for lower-case ASCII `.com`/`.net` only. No premium pricing, unsupported extensions or IDN assumption.
- `CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED=false` by default. After separate provider proof and operator approval, this flag may be switched on **without** enabling customer checkout or purchase.
- Admin invokes `POST /api/providers/connections/{uuid}/registrar-quote/` with exactly `domain`, `confirm_password` and fresh `totp_code`. Server enforces verified Super Admin, key custody and DB audit trigger, decrypted current bound draft, signed audit history and durable throttle.
- Returns only five-minute short-lived supplier cost+availability, marked non-executable, not a retail offer. On any network, credential, tampering or audit failure, returns sanitized denial. No mutation path in the connector.
- Cloudflare readback is not a supplier registration transaction and never creates an Octalve customer domain, order, invoice, wallet credit or DNS entry.

### D4 — Real domain purchasing / future execution acceptance (NOT implemented)

A live registration will only be considered after **all** of these independently evidenced checks and a fresh reviewed PR:

1. Approved registrar commercial/reseller terms, billing profile and verified registrant email. For Cloudflare, registrants are bound to Cloudflare nameservers; user must accept the restriction.
2. Per-TLD real-time availability, premium and regulatory restrictions, price currency, supplier charges, annual renewal, registration contact obligations, supported years, applicable taxes, margin, FX conversion source/expiry and published retail price version. Do not assume a USD supplier price is an NGN price.
3. Independent payment settlement verification and exact authenticated customer authorization for a named domain, registrant and price; a cart/checkout redirect is **not** settlement proof.
4. Durable **single-intent idempotency key** tied to order item, domain, registrar, term, quote and consent snapshot, protected in PostgreSQL with uniqueness/transaction locks. A timeout or 202 response means outcome UNKNOWN until supplier status reconciliation; **never blindly retry a potentially billable POST**.
5. Separate mutable lifecycle and immutable append-only external supplier receipt recording with supplier reference, registration status, timestamps and contact privacy. No forced `Domain.status=active` without verified supplier confirmation.
6. Supplier operation allowlist, restricted outbound networking and least-privilege separated purchase token; no arbitrary URL, customer-controlled request body, token or redirect.
7. Explicit approval for any first **real billable transaction** stating exact domain, customer, provider, TLD, term, confirmed non-refundable charge and recipient contacts; no bulk or default purchase.
8. Tests covering double-click, provider timeout, partial response, price changes, token compromise, contract errors, registrant verification failure, missing funds, fraudulent settled events, provider error masking, rollback limitations and reconciliation after restart.

> Cloudflare Registrar API purchase can charge the account immediately and is not refundable after completion. No charge is attempted in INT-03.

### D5 — Other registrar providers

- ResellerClub, Namecheap, OpenSRS, Openprovider and others must be independently evaluated for current reseller eligibility, API auth, egress IP requirements, supported TLDs, pricing, renewals, transfer contacts and idempotency. Their Integration Store cards are requirements, **not qualified adapters**.
- Each provider gets a distinct vault schema, separate read-only proof, supplier cost quote, customer consent and execution adapter. Do not copy Cloudflare API method paths or assume generic registrar responses.
- No provider tokens should be pasted into chat, GitHub, Preview deployments or non-escrow files.

## Operator sequence — no repeated key generation

1. Keep the existing independent five Fernet/HMAC keys; **never re-create, paste or rotate them for vendor onboarding**.
2. Confirm **off-device encrypted key escrow restore**, actual production owner MFA, audit immutability and one-user operation approval. A previous local `--verify` alone is not independent off-device evidence.
3. Since the owner has enrolled MFA, disable `CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED` for Production (existing owner step-up continues working). Keep purchasing, registrar execution and DNS mutations disabled.
4. Permit initial `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS=cloudflare-dns` only after the deployment operator attests key custody, backup and controlled change window. Set `CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=true` and `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=true` **only for the provider-vault draft intake** with a separate documented change. These switches do **not** enable supplier execution.
5. Configure a **distinct** zone-scoped Cloudflare token in the Admin Integration Store (not in general Vercel email SMTP settings); verified Super Admin enters account password and fresh TOTP. Run only the read-only Cloudflare zone verification.
6. After DNS passes and nonsecret audit evidence is retained, separately allowlist `cloudflare-registrar-live`, add a dedicated registrar token as a draft, and validate the read-only `domain-check` only after `CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED=true` is approved.
7. Leave `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS` narrowed between approved provider-specific test windows. Do not assume the source deployment alone activates any connection.
8. Inspect a representative quote for .com/.net but **do not register** it. Real purchasing remains a future distinct batch requiring D4's full lifecycle.

## No-go status

| Capability | INT-03 reviewed-source outcome | Production certification |
|---|---|---|
| Owner MFA | Existing verified enrollment | Verified before batch |
| Independent off-device key recovery | Required evidence | Not independently inspected here |
| Cloudflare DNS readback | Exact zone + bounded complete paging | Live scoped token not yet saved |
| Cloudflare Registrar sandbox | Existing isolated test connector | Sandbox token not yet saved |
| Cloudflare Registrar live price check | New default-disabled code | Not yet live-certified |
| Other registrar quotes | Requirements research only | Not connected |
| Cloudflare DNS changes | No implementation | **BLOCKED** |
| Real domain registration / transfer / renewal | No implementation | **BLOCKED** |

## Reference docs

- Cloudflare Registrar API beta: https://developers.cloudflare.com/registrar/registrar-api/
- Cloudflare Registrar restrictions: https://developers.cloudflare.com/registrar/get-started/register-domain/
- Cloudflare API token permissions: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- Cloudflare exact zone details: https://developers.cloudflare.com/api/resources/zones/methods/get/
- Cloudflare DNS record list: https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/list/
- OWASP API Security Top 10 2023, Sensitive Business Flows and SSRF: https://owasp.org/API-Security/editions/2023/en/0x00-header/
