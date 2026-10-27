# Octalve Cloud — Batch 11: Domain Management and Registrar Integration Gates
2026-10-27. Baseline: `6cd7ffa7abcf683c7fbbf1c7687ad1b1c412b096`.

## Research and authoritative requirements
- ICANN Transfer Policy: registrant authorization, unique AuthInfo/EPP code, registrar lock and 60-day restrictions (creation, recent transfers and certain changes of registrant) apply as specified for gTLDs; ccTLD registry rules may differ. Transfer finality is determined by registry/registrar confirmation, not an internal form.
- ICANN Expired Registration Recovery Policy (2024 update): gTLD registrars are responsible for expiration reminders approximately one month and one week before expiration, with applicable post-expiration notice. Consumer UI reminders alone are not a substitute for compliant registrar notices.
- Keep server-managed registrar pricing, verified eligibility, idempotency, authoritative provider API confirmations, reconciliation and compensation. Don't store EPP transfer secrets in logs, support chat, plaintext form state, URL or publicly accessible metadata.

Official standards:
- https://www.icann.org/en/contracted-parties/accredited-registrars/resources/domain-name-transfers/policy
- https://www.icann.org/en/contracted-parties/consensus-policies/expired-registration-recovery-policy/expired-registration-recovery-policy-21-02-2024-en

## Completed Batch 11 code
1. Client navigation: My Domains / Register New Domain / Transfer Domain to Us. Registration search is a separate guided route. Existing domain search uses published rates but no fabricated registrar availability.
2. Domain detail `/client/domains/[id]` now directly fetches the exact owner-authorized record instead of looking for it on the first page of a paginated list.
3. Domain overview includes registration date, expiry, next due, registrar, stored auto-renew preference and DNSSEC flag; scoped child views include `/dns`, `/nameservers`, `/renewal`. Existing shared mobile/desktop `CloudRecordDirectory` is reused for read-only DNS/NS rows. Unsupported action menus are hidden, not offered as inert controls.
4. Domain transfer preflight via `GET /api/domains/domains/transfer-readiness/?domain=...` validates domain input, uses longest active/published TLD suffix, and shows **indicative** transfer price if configured. State is explicitly `registrar_verification_required`; `transfer_eligible=null`; `registrar_connected=false`; `checkout_enabled=false`. No EPP collection, transfer application, invoice or payment on this endpoint.
5. Renewal status via `GET /api/domains/domains/{id}/renewal-status/` returns only an already-issued, eligible, unpaid/part-paid/overdue `domain_renewal` invoice matching the authenticated client and exact domain ID. No invoice is generated and no expiry extended via GET. Otherwise requests route to support.
6. Removed arbitrary `metadata` from `DomainSerializer` to prevent provider data and other sensitive internal settings leaking into Client/API responses.
7. Added isolated Django tests for ownership, secret redaction, DNS read paths, unauthorized accesses, transfer preflight and zero-write mutations. Added Batch 11 frontend CI contract guard.
8. Existing DomainSearchViewSet/register/transfer, DomainViewSet DNS/name-server/renew, and DNSRecordViewSet mutations **remain 503** until externally verified provider execution is implemented.

## Important implementation limits and work left under Phase 4
The current repository has `providers.registry.ProviderRegistry` with **DirectAdmin hosting** only; there is NO connected/sandbox-certified domain registrar adapter. Domain registration, inter-registrar transfer, zone editing, nameserver updates and renewal cannot genuinely execute. Connecting a registrar requires approved credentials, IP allowlists/vendor test account, per-operation capability and TLD restrictions, immutable quoted supplier pricing, confirmed payment, durable idempotent outbox/worker, retries/reconciliation, audited provider readback, registrant-consent flow, EPP encryption/expiry/erasure, error recovery and nonsecret operational telemetry. **Do not simulate these operations, claim they are complete, or enable them by UI toggle.**
The approved registrar adapter must be certified with synthetic test domains in vendor sandbox before any non-test account can execute.

## Release
- Existing `review/cloud`, no new long-lived branches. Exact-head TypeScript/Next, Django API/security, disposable Postgres, CSS and route inventory checks, then SHA-locked merge to `main` and Production deployments.
- Batch 11 adds five new Client pages: register, transfer, DNS, nameservers and renewal. Route inventory grows from 125 total / 25 Client to **130 total / 30 Client**. Browser acceptance is therefore 130 × 6 = **780 real authenticated viewport cases**. CI inventory creation is not browser evidence.
- Zero migrations in Batch 11, no local production PowerShell migration required. Global legacy CSS remains protected.
- Keep OPanel authorization, checkout, payment settlement, provisioning, invoice-state transitions, and provider operations unchanged.

## Operator acceptance
1. Refresh live Console, Client → Domains: My Domains list and three-dot action sheet; verified detail, DNS/NS pages; confirm no fake editing buttons.
2. Registration page: check published pricing but ensure no unverified availability/paid invoice appears.
3. Transfer page: valid/invalid domain, active TLD indicative price vs unsupported TLD, no EPP input, no transfer submission.
4. Renewal: check existing confirmed renewal invoice or request assistance; verify cross-tenant 404, unchanged expiry/records.
5. Admin/Staff regressions and 780 signed browser parity cases remain separate launch gates.

## Next batches
Batch 12: in-app invoice/expiry notification delivery, O-Cloud Clan. Batch 13: rewards and audited affiliate ledger. Batch 14: multi-language under Settings. Batch 15: complete signed browser and CSS retirement qualification. Phase 4: real registrar, DNS and OPanel provider adapters.
