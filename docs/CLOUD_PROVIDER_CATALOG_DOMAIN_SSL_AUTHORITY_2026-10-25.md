# Octalve Cloud — Provider, Catalog, Domains, DNS and SSL Authority (25 Oct 2026)

**Status:** Architecture decision + phase-0 safety patch, on non-deploying branch `phase/cloud-provider-authority-preflight`. This is not a complete commercial feature implementation. No Neon migration, provider connection, external purchase, Vercel deployment or Production change is authorized by this document.

## Fundamental decision: there is NOT one universal external provider source of truth

An external provider owns **supplier capabilities and facts** (packages, reseller costs, availability, domain renewal/expiry, actual provisioned state). The **Octalve administrator** owns retail prices, policies, product naming, marketed features, provider selection, and publication. Octalve's Django business database owns the approved offer version, quote snapshot, order/invoice ledger, customer identity and operational state. External DNS authority owns *the DNS records currently served on the Internet*; the registrar owns domain registration; hosting operator owns provisioned website space; certificate issuer/ACME client owns issuance facts. Never confuse them.

| Concern | Supplier / external authority | Octalve decision and canonical record |
|---|---|---|
| Shared hosting capacity, features | DirectAdmin/server | Admin-reviewed PackageMapping and published Plan/PlanFeature |
| Hosting sale/renewal price | Provider wholesale cost, optional FX | Admin-reviewed PlanBillingCycle and promotion (versioned) |
| TLD availability & premium status | Selected registrar API, realtime | Provider quote cached with TTL; never guess |
| Domain registry state/expiration | Registrar/registry | Domain ownership, registrar linkage, local state reconciled to provider |
| Domain retail prices | Registrar cost / registry renewal rules | Admin-approved TLD+operation+term+currency price book |
| Effective DNS records | Active authoritative DNS provider | Octalve DNSZone mapping, pending change and confirmed record snapshot |
| Hosting ↔ domain link | Hosting service + independently owned domain | Explicit verified DomainAttachment; owned vs externally registered domains |
| Public SSL/TLS | ACME issuer, DNS challenge / webserver | Policy approved by admin, certificate proof+expiry+renewal status |
| Paid SSL | CA/reseller catalog + real quote | Approved offer/price and verified purchase workflow |
| Mailboxes and routing | Selected mail provider | Admin product, customer domain proof, DNS MX/SPF/DKIM/DMARC |
| Invoice amount | Never browser/client or provider alone | Frozen quote, checkout, invoice snapshot; later price change must not rewrite |

## Existing repo audited 25 Oct 2026

- Django models: `catalog.ProductCategory/Product/Plan/PlanFeature/PlanBillingCycle/PlanProviderMapping`, `providers.Provider/ProviderPackage`, `domains.Domain/DomainNameserver/DNSRecord/TLDPricing/SSLCertificate`, `orders.Order/OrderItem`, `billing.Invoice`.
- Customer pages `/client/order` and `/client/order/checkout` load `/api/catalog/plans/`, use only active/public hosting plans, and server recalculates totals against `PlanBillingCycle.price + setup_fee`.
- Existing Admin editor posts `price, cycle, storage, bandwidth, product name`, but plan serializer expects `product` FK and has **read-only** `features`/`billing_cycles`. Correct in a future single Product & Pricing Manager rather than treating the existing form as complete.
- Provider registry has a concrete DirectAdmin adapter, other types mostly registry/config placeholders. Provider `sync_packages` returned fake success. Supplier `ProviderPackage` previously leaked active wholesale packages to clients and allowed client writes. This phase blocks those.
- Domain check was simulated, suggestions contained hardcoded TLDs and a 15000 price, SSL order hardcoded DV/OV/wildcard fees. Domain order/transfer code used placeholder `product_id=0` and `plan_id=0` and persisted EPP codes inside order config. Domain/DNS operations altered local records before external confirmation, or without any DNS provider.
- There are no live catalog, TLD pricing, provider, order or domain records in Production as audited. Provisioning/payment settlement remain intentionally disabled.
- Domain model has registrar/provider relationship but **no explicit hosting service ↔ domain attachment**; provider_id is currently overloaded for registrar and DNS capability.

## Target object model — design only, migration NOT applied

Reuse existing models; add schema only once per qualified batch:
- `ProviderCapability`: provider + capability type (hosting/registrar/dns/ssl/mail) + supported operations + tested credentials/version + health. Use real adapter registry and connection test; no arbitrary URL egress (SSRF).
- `SupplierOffer`: provider package/TLD/SSL type, provider external ID, product specs, cost price, cost currency, last successful sync and stale/unsupported flag. Never expose wholesale costs or provider tokens to clients. Manual import allowed with explicit provenance.
- `RetailOfferVersion`: maps supplier offer to Product/Plan, admin-approved retail prices and effective dates; status DRAFT → REVIEW → PUBLISHED → RETIRED; price per operation, term and currency; immutable historical versions. Retail prices do **not** auto-overwrite on supplier sync.
- `RegistrarTLDPolicy` and `TLDPriceBook`: per registrar + TLD + register/transfer/renew/restore + years + currency; registry restrictions, premium/domain-price lookup, grace/redemption, privacy, restrictions; admin review, version and quote expiry.
- `DomainQuote`: token/ID, account/customer, domain, registrar, operation, years, premium status, retail total, supplier price/check timestamp/expiry, uniqueness/idempotency; on checkout server re-verifies quote/price; expired quotes cannot be accepted.
- `DomainRegistration` (extend current Domain): registrar ID, provider-domain ID, domain owner, registry status, dates, renewal state, EPP secret managed securely, no raw EPP in order config, transfer lock and ownership-verified external attachment.
- `DomainAttachment`: normalized domain + optional existing Domain + Service ID + verified owner + site role (primary/alias/addon/subdomain) + status, unique collision controls and record of intended web target. Do not require buying domain from Octalve to host it.
- `DNSZone`: domain, DNS provider (distinct from registrar), authoritative NS observed, zone ownership, previewed change set + external-confirmed record IDs/serials, audit and conflict checks. Editing non-authoritative provider must show **not effective**.
- `CertificateOrder/CertificateDeployment`: free ACME vs paid provider, validated identifiers, challenge method HTTP-01/DNS-01, issuer, certificate expiration/renewals, deployment target and separate Cloudflare EDGE vs origin SSL distinction.
- `ProviderAction` + durable worker/reconciliation/audit: atomic outbox/leases/idempotency, retry limits, provider-confirmed activation, compensation and manual review. Never perform real registration/provisioning in customer HTTP request.

## Customer workflows

### Choose hosting + domain (must support four independent paths)
1. **Register a new domain**: registrar real-time availability + premium price + admin-approved quote; customer contact & local-presence validations, privacy, TLD term, payment authorization; after verified payment, enqueue registrar registration and hosting provisioning separately; connect via authoritative DNS, then ACME, then service active.
2. **Transfer existing registration**: preserve domain's current website/email/DNS during transfer. Validate EPP/AuthInfo and registry lock state, quote term/transfer policy and user consent; create dedicated transfer state machine; do not assume transfer automatically migrates website.
3. **Use externally registered domain**: take domain name, prove ownership (DNS TXT/CNAME or registrar authorization) before binding; customer chooses change NS vs keep external DNS + A/AAAA/CNAME. No Octalve domain registration charge.
4. **Use domain later/temporary URL**: activate only supported temporary hostname, allow verified domain attachment afterward.

### Hosting DNS, mail and SSL
- Web hosting and domain registration renew independently. A domain can point to external hosting, and a hosting account can use an externally purchased domain.
- Show authoritative NS vs configured DNS provider. Warn before NS switches and inspect existing MX/SPF/DKIM/DMARC, DNSSEC/DS, CAA and other records. Never replace mail routing silently.
- DNS changes use reviewable diff → user confirmation → provider mutation via dedicated adapter → verified propagation/status; no local success until provider accepted.
- Free SSL must be offered when supported by the hosting stack (ACME/Let's Encrypt); paid SSL only as a separate verified SKU. HTTP-01 vs DNS-01 and wildcards differ. Distinguish CDN edge SSL from encryption to origin server.
- Domain bought with an Octalve hosting package should have **separate lines** for domain term/renewal, hosting term, SSL (if paid), mail (if paid), tax/discount, and future renewal totals. Coupon/free domain eligibility is versioned policy, not hardcoded free dot-com assumption.

## Admin UI — one cohesive configuration workflow

`Providers → Connections`: capability, provider type, endpoint allowlist, least-privilege secrets, test connection, sync packages and TLDs into **staging**, inspect provenance and errors. No self-sign-up provisioning test button in live HTTP routes.

`Catalog → Offers`: choose synced/manual approved provider offer; set product/type, caps and displayed features; assign Octalve retail price by period, discounts, promotions, currency; draft preview and admin publish. Warn if marketing limits > actual technical package caps. Plan sync never silently publishes.

`Domains → Registrar Settings`: configure approved registrar(s), TLDs, per-operation/year pricebooks, premium domain quote policy, allowable contacts, privacy, renewals and grace/transfer rules. Do not select first active registrar nondeterministically; use admin-prioritized routing per TLD/currency.

`DNS Providers`: manage independent DNS adapters, authoritative zone ownership, safe zone import, records, DNSSEC/DS, templates, preview diff and verification.

`SSL`: free ACME policy, wildcard eligibility, automated validation and renewal, approved paid-SSL suppliers, origin/edge certificate lifecycle and alerts.

`Mail`: separate mail provider, domain verification, MX/SPF/DKIM/DMARC, no automatic overwrite of existing external mail settings.

Each screen has DRAFT/SYNCED/PUBLISHED/DEGRADED status, last-verified timestamp and provenance, role-based permissions, audit log, and explicit failure states.

## Release batches (no "one giant merge")

- **A0 now (branch only):** fail closed for unverified operations, remove hardcoded domain/SSL price offers, block client pricing/provider writes and wholesale data access, CI checks. **Does not enable selling domains or SSL.**
- **A1:** audited provider connection/inventory sync and app permissions; provider adapter contract/capabilities, tests with fake HTTP/provider and proven no secrets in responses.
- **A2:** admin Product/Plan/Features/BillingCycles/TLD retail price authority and publish workflow, transactional snapshots and read APIs; pass cases for 1/3/6/12/24-month terms, FX/cost vs retail, price changes after invoice, inactive products, mismatched provider package.
- **A3:** independent domain→hosting attachment and DNS change planner, external domain ownership proof; no real provider mutation yet.
- **A4:** real chosen registrar and DNS provider (one of each initially), availability/quotes, transfer/renew, idempotent durable worker, provider reconciliation and payment settlement prerequisites.
- **A5:** ACME free SSL, paid SSL adapter if needed, renewal scheduler and mail DNS templates.
- **A6:** browser acceptance across admin/client/staff, desktop/mobile, failure paths and publish gating. Only then commercial enablement.

## Hard release gates

No domain or SSL purchase without live provider evidence + admin approved valid quote + frozen server-side amount + real order/invoice snapshot. No state mutation based solely on browser action. No provider operation before verified settlement/approved operations. No deployment on this branch; `frontend/vercel.json` and `backend/vercel.json` disable Git deployments for non-main branches. PR CI is the only automatic external operation. Production Neon remains 49/92 and unchanged until an audited future migration.

## Industry references (official)

- WHMCS product/pricing/module separation: https://docs.whmcs.com/9-1/products/products/
- WHMCS registrar and TLD pricing/auto-registration: https://help.whmcs.com/m/setup/l/1075242-configuring-domain-extensions-tlds
- Hostinger external domain links via nameservers or A record: https://www.hostinger.com/support/1863967-how-to-point-a-domain-to-hostinger/
- Zoho Mail ownership verification and active authoritative DNS: https://www.zoho.com/mail/help/adminconsole/domain-verification.html
- Cloudflare proxied vs DNS-only TLS coverage: https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/
- Let's Encrypt ACME challenges: https://letsencrypt.org/docs/challenge-types/
- ICANN AuthInfo transfer code: https://www.icann.org/resources/pages/auth-2013-05-03-en
