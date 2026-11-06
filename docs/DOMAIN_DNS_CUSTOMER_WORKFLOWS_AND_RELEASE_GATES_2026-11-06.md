# Octalve Cloud — Customer domains, DNS and registration release plan

**Date:** 2026-11-06  
**Current credential:** an independently authenticated Cloudflare **DNS Read** connection for Octalve's own zone `octalve.com`, saved as a Live provider connection. This credential DOES NOT authorize other customer zones, DNS writes, registrar purchases, nameserver changes, or resale.
**Customer-facing promise:** a domain must belong to the authorized customer and be controlled by a specifically approved DNS connection before Octalve displays or changes its settings.

## Production product separation

1. **DNS service**: points a domain to the customer's hosting, email and services; Cloudflare is an optional DNS provider. DNS authority requires the exact zone, an active provider account, and its delegated nameservers. A DNS token is **not** a domain registration credential.
2. **Registrar**: searches, registers, renews and transfers domain ownership at a registry. A quote is not a reservation or a purchase. Vendor availability, real-time supplier price, commercial reseller rights, customer billing and registrar ownership must be independently certified.
3. **Hosting**: a paid Octalve service mapped to an actual panel account or OPanel service. DNS can reference hosting only after verified service ownership and an approved endpoint.
4. **Client domain dashboard**: shows the customer's own domains, ownership and renewal status, authoritative DNS provider, and allowed activities without exposing provider keys.

## Existing source truth

- `IntegrationConnection.state` has only `draft`/`revoked`. A successful check was audited but not reflected in the saved-connection status: the card could misleadingly show `Awaiting verification`.
- This batch adds a **display-only**, evidence-backed `verification_status`, matched to exact connection ID + adapter + credential version and exposed by the authenticated Admin provider registry. The existing successful production audit receipt can show Verified without repeating TOTP.
- `Verified` means a successful check within the previous **7 days**. Older evidence is `Recheck access`. A rotated credential cannot inherit verification from the previous version, and a revoked connection is never Verified.
- UI status does **not** authorize any vendor mutation. The provider action flags and payment authority remain independent.
- `providers.cloudflare_int01.CloudflareINT01.dns_readback` currently validates **one exact active zone** and reads all bounded DNS pages, but returns an authenticated **count and SHA-256 digest**, not a customer-facing record table.
- `domains.views` deliberately fails closed on new domain registrations, DNS writes, renewals and supplier mutations. The existing `DNSRecord` database model is **not an authoritative reflection of Cloudflare** unless a provider-backed snapshot/reconciliation is introduced.
- Cloudflare Registrar live quote-only check is independent from the DNS token; it supports initially restricted `.com`/`.net` check but no order placement.

## DNS-01 — Authoritative ownership and safe inventory

1. Introduce explicit `Domain ↔ customer ↔ provider zone ↔ connection` bindings as reviewed data, with exact zone name, current DNS authority, customer consent, ownership verification timestamp and immutable approval evidence. Never infer authority from a domain string or from the presence of a token.
2. Permit either (a) Octalve-managed Cloudflare zone under a documented customer authorization, or (b) customer-owned Cloudflare account using tenant-isolated zone-scoped credentials. Do not reuse Octalve's `octalve.com` token for client domains.
3. Build read-only DNS inventory from authoritative provider responses and compare a bounded snapshot; render A, AAAA, CNAME, MX, TXT, CAA and supported types with TTL, proxied status where applicable, and last checked. Avoid exposing confidential account identities and internal tokens.
4. Verify that Cloudflare is authoritative (nameservers), the zone is active and the authenticated account and zone match the binding. Show `DNS provider not connected`, `Nameservers pending` or `Verification needed` instead of inventing active status.
5. Enforce owner-scoped client reads and staff/admin role boundaries. Test cross-tenant IDs, another customer's zone, missing roles and stale delegation. No provider writes.

## DNS-01 implementation and Production acceptance (PR #118)

This is an **additive read-only** customer DNS release. The approved source branch is
`feature/dns-01-read-only-20261106`; do not introduce a parallel DNS service.

1. **Safe schema release**: `domains.0002_dns_readonly_binding` creates the
   `DomainDNSBinding` authority table. Existing Domain/DNSRecord rows are not
   converted into approved Cloudflare connections. First confirm a fresh
   **independent Production database backup**, its restoration evidence, and
   the exact migrations pending on the target Neon branch. Use
   `scripts/plan-neon-production-dns01.ps1` for both the separate
   **-Preflight** (read-only) and **-Apply** (guarded) modes. The old Console
   Settings runner is NOT suitable for DNS-01. Apply repeats Preflight, makes
   a fresh private custom-format PostgreSQL archive, restores the full
   archive into a temporary loopback-only Windows PostgreSQL instance,
   independently confirms the original 62/115 ledger, checks SHA-256,
   removes the temporary restored database, and then requires the exact
   typed release approval before running only `domains.0002`.
   The Python runner independently confirms exact Neon host/role/TLS,
   original ledger, migration plan and final 63/116 schema, including the
   DNS binding index, six foreign keys and zero automatically enabled
   customer bindings. Never auto-migrate from Vercel or use old batch
   scripts. **Backup must remain protected on an encrypted workstation.**
   On 6 November 2026, the Neon project refused both a new snapshot and a
   zero-compute backup branch because the quota was exhausted. Do not delete
   any existing Neon branches/snapshots to bypass this restriction. Continue
   only after an independently secured, restorable `pg_dump` or a provider
   backup has been verified.
2. **Release gate**: `CLOUD_DNS01_READONLY_ENABLED` defaults to false.
   Keep it disabled until successful Production migration, owner/tenant tests,
   current Super Admin security checks and verified browser acceptance.
3. **Release code**: deploy the reviewed same commit to `octalve-cloud-api` and
   `octalve-console` with the standard CI/permissions gates. Check deployed
   Git SHA for both before declaring readiness. Confirm PR #117 status fix is
   actually on Production; a GitHub merge is not deployment evidence.
4. **Admin connection flow**: in the existing Integration Store verify a
   **live, DNS Read + Zone Read**, specific-zone Cloudflare connection. The
   Admin must identify the existing customer Domain and authorization evidence,
   then choose the matching saved connection in Domain profile → DNS access.
   The server checks the exact zone name, zone ID, account ID and active zone.
   A valid token alone grants **no customer access**.
5. **Customer consent**: the **current exact domain owner** must explicitly
   approve read-only access from My Domains → DNS records. A new owner cannot
   inherit the previous owner's consent. Only afterward may a verified Super
   Admin grant access with a fresh password and one-time authenticator code.
6. **Live customer experience**: Client and Admin DNS tables are populated
   **only by a fresh Cloudflare GET** on the approved zone; unsupported,
   interrupted, mismatched, expired/rotated or revoked accounts fail closed.
   Records show host, type, value, TTL and proxy information. Cloudflare's
   reported zone nameservers are **not proof of the actual public registrar
   delegation**; do not imply independent public DNS verification.
7. **Immediate customer control**: customer may revoke an approval and no
   new DNS records may be returned under that authorization. An in-flight
   provider response is rechecked against the current owner, credential
   version and consent before disclosure.
8. **Capacity policy**: single zone snapshots are limited to 1,000 records
   and 10 complete pages, with bounded provider HTTP responses. A zone that
   exceeds the approved bound must display unavailable, **never** silently
   omit records and claim completeness. Increase limits only after isolated
   performance and security qualification.
9. **Negative acceptance**: test another customer's ID, role spoofing,
   revoked credentials, ownership transfer, customer withdrawal while a
   provider call is in flight, missing/extra supplier pages, mismatched
   zone and account, bad TTL, malformed provider response, audit failure,
   database outage, concurrent admin actions and failed deployment/migration.
   No DNS mutation, registrar purchase, registration or service activation
   is implied or enabled by DNS-01.

**Production release constraint:** Do not switch on DNS modifications or
domain purchasing. No customer/domain bindings are created automatically by
merging the code. First approved live connection remains scoped to
`octalve.com`; it is never silently assigned to another customer's domain.

## DNS-01 local Production procedure — reviewed release

Use Windows PowerShell 5.1+ with Python 3.12 and a supported local
PostgreSQL distribution containing `pg_dump`, `pg_restore`, `initdb`,
`pg_ctl` and `psql`. Install these tools on a BitLocker-protected or
equivalently encrypted operator workstation. Never paste Neon credentials
into GitHub, ChatGPT, or a script; both modes prompt for the direct
Production database connection URL via hidden input.

From the root of the local `octalve-core/octalve-console` checkout:

```powershell
git checkout main
git pull --ff-only origin main
powershell -ExecutionPolicy Bypass -File .\scripts\plan-neon-production-dns01.ps1 -Preflight
powershell -ExecutionPolicy Bypass -File .\scripts\plan-neon-production-dns01.ps1 -Apply
```

The runner refuses a dirty checkout, non-main branch, wrong GitHub origin,
stale origin/main, CI/Vercel execution, a pooled/wrong Neon endpoint,
unexpected migration count, unrelated migrations, and a failed or outdated
local restore. **-Apply is not unattended:** it prompts for the exact phrase
`APPLY DNS01 0002 TO OCTALVE PRODUCTION` after recovery qualification.
If the migration has already been applied, it verifies the 63/116 postflight
and **does not repeat** it. If the script aborts, inspect the actual ledger
before any retry; retain the fresh archive and do not change DNS flags.

After a successful 63/116 migration, separately confirm both deployed
Git SHAs, the Super Admin status and server-owned customer approvals.
Only after browser acceptance and credential custody verification may the
operator consider `CLOUD_DNS01_READONLY_ENABLED=true` in the **API**
Production environment. Changing the flag requires a separate controlled
deployment and proof that unauthorized Client and Staff accounts cannot
retrieve another customer's zone. Never activate DNS Write or Registrar
purchase flags as part of this migration.

### Registrar qualification and purchase separation

Cloudflare Registrar's authoritative availability endpoint is a **read-only
POST** that may return supplier registration and renewal costs; it is not a
permission grant to resell or purchase, nor a published NGN customer price.
Openprovider's reseller API requires an active account, API access and
applicable registry contracts. Before REG-01 becomes customer-facing,
confirm supplier agreements, supported TLDs, registrant ownership, tax,
FX/currency and fees, versioned published offers and payment settlement.
DNS-02 requires a **separate** per-zone DNS Write credential and an approved
disposable test zone. REG-02/03 require a persistent idempotent registrar
operation/settlement ledger and reconciliation after ambiguous timeouts.
No live purchases or DNS modifications are enabled by DNS-01.

## DNS-02 — Safe changes with a separate write token

1. A **different zone-scoped DNS Write token** per approved management scope. Never upgrade or overwrite the working DNS Read token. Allow only required Cloudflare methods to exact zone and record IDs.
2. Start with **create/update A, AAAA and CNAME** under an approved bound domain, with domain and hostname allowlists, CNAME conflicts, TTL validation, and Cloudflare proxy compatibility. Add MX/TXT/CAA only after isolated tests and explicit business-email/DNSSEC recovery procedures.
3. Before applying: show record type/name, **previous value**, requested value, DNS effect and warning; require an owner-confirmed request and, for high-risk domains/record types, a separate Octalve administrator approval. No mass DNS import or delete by default.
4. Protect against concurrent edits with a current provider-read version/digest precondition, idempotent operation key, short expiry, owner role and a recent MFA step-up for privileged actions. An old preview must not overwrite a newer DNS record.
5. Audit **request, approval, vendor response and verified provider readback**. Capture nonsecret snapshot for recovery; make rollback an independently approved change (Cloudflare may propagate records at different times; a database transaction is not a DNS rollback).
6. Feature-flag by operation, domain and role. Fail closed on provider timeout, rate limiting, permission change or mismatched DNS owner. Never automatically modify `octalve.com` or other production zones to test.

## REG-01 — Real commercial supplier qualification

1. Choose a registrar with **explicit commercial/reseller rights** and sufficient support for registration, renewal, transfer, registrant contacts, expiry evidence, pricing and applicable TLDs (including Nigerian ccTLD if offered). Compare dedicated reseller systems separately from Cloudflare Registrar.
2. Complete supplier onboarding, account and pricing eligibility, paid customer/registrant identity requirements, transfer restrictions and billing setup. Cloudflare Registrar's API supports availability checks and billable registration; it is not evidence of a wholesale reseller agreement.
3. Persist an authoritative quote with TLD, supported years, vendor amount and currency, FX source, taxes, margins, public offer version and expiry. Verify live availability again before registration. Do not use stale prices or conflate USD supplier cost with NGN customer retail price.
4. **Customer consent and verified payment settlement first**, including exact domain spelling, TLD, term, final price and required registrant contact. Display non-refundable supplier terms clearly.
5. Build a durable one-attempt registration ledger unique to customer/order item/domain/provider/term, with a one-time idempotency key and controlled transactional transition. On a supplier timeout the result is **unknown** until independently reconciled: never blindly repeat a potentially billable registration.
6. Only after an authentic supplier confirmation create/update `Domain` to `active`; otherwise retain pending/failed/unknown status with timestamps and escalation. Emit immutable receipts and record registrar reference and expiration.
7. Renewal, transfer, redemption and owner-contact changes are independently qualified operations. Never assume a specific provider's beta API supports all of them simply because registration works.
8. Security tests: two clients racing for same domain, double-click/retry, changed price, malformed response, compromised token, wrong registrant, failed payment, lost callback, vendor charge without domain record, customer account mismatch, provider 429/5xx and crash/restart recovery.

## Ordered implementation and acceptance

| Batch | Deliverable | Release constraint |
|---|---|---|
| VERIFY-01 | Persisted evidence-derived `Verified / Recheck access / Awaiting verification` UI | Safe to deploy: read-only, no migration or supplier execution |
| DNS-01 | Customer/domain ownership binding and authoritative read-only DNS inventory | No DNS Write permission; customer data strictly owner-scoped |
| DNS-02 | Diff/approval-based DNS changes with separate write token | Start only on explicitly approved **disposable** zone; `octalve.com` read-only |
| REG-01 | Registrar capability/contract certification, accurate quotes, order-intent ledger | No vendor charge without a specific approved test purchase |
| REG-02 | Single-attempt paid registration with reconciliation | Requires settled payment, customer consent, reseller agreement and purchase-specific approval |
| REG-03 | Renewals, transfers, contact changes and customer service access | Separate provider-supported certification, never assume availability |

**Production setting:** no new DNS Write, supplier execution or registrar purchase gates are enabled in VERIFY-01. No live Cloudflare credential is transferred to another application.

## Official references

- Cloudflare DNS record endpoints: https://developers.cloudflare.com/api/resources/dns/
- Cloudflare DNS proxy behavior: https://developers.cloudflare.com/dns/proxy-status/
- Cloudflare Registrar API: https://developers.cloudflare.com/registrar/registrar-api/
- Cloudflare Registrar domain registration restrictions: https://developers.cloudflare.com/registrar/get-started/register-domain/
- Cloudflare domain registration agreement (2026): https://www.cloudflare.com/domain-registration-agreement/
