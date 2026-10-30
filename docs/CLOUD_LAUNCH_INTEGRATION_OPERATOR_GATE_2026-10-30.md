# Octalve Cloud — launch integrations and operator acceptance (30 October 2026)

## Current scope and truthful release state
- Console + API currently deploy Production from reviewed GitHub `main`. This document does not authorize payment collection, DNS writes, registrar transfers, provider-account creation, OPanel technical operations or public secret-entry.
- **OPanel** is a first-party Octalve technical product in a separate repository. Console remains the only commercial customer/ownership/billing/provisioning authority. It is not a DirectAdmin/WHM supplier; it may use those panels as backend adapters.
- **Brevo** already had the `brevo` server-owned connection schema. This batch adds the missing Integration Store card, official API, verified domain instructions, and test contracts.
- **OPanel** now has a discoverable integration card, exact existing Console brand icon, and inert server-owned metadata schema. No live SSO setting is changed.
- The provider connection vault refuses Production mutation even with flags set. The Store is for requirements and read-only draft status, **not** an active credentials form.
- Never infer integration readiness from a saved draft, logo, provider health badge or GET /health.

## OPanel: owner preparation
1. Choose/deploy a truly independent OPanel frontend, Django backend, private DB, isolated worker/node and TLS endpoints; do not reuse the Console account database.
2. Record the exact `OPANEL_CALLBACK_URL=https://<approved-opanel-origin>/auth/callback/`, `CONSOLE_API_BASE=https://api.cloud.octalve.com/api`, `CONSOLE_WEB_ORIGIN=https://console.cloud.octalve.com` and a distinct `OPANEL_CLIENT_ID` in both apps.
3. Generate a high-entropy `OPANEL_CLIENT_SECRET` (32+ characters) in a secret manager and configure the *same* confidential-client credential in Console API and OPanel server. Never paste into chat, client pages, catalogue metadata or unapproved credential forms. Do not reuse the Django secret, provider reseller token, payment key or recovery key.
4. Leave `OPANEL_ISSUER_ENABLED` OFF until independent deployment/SSO and service binding evidence are certified. A source README is not proof of an operational OPanel origin.
5. In Admin `/admin/integrations?provider=opanel` inspect requirements. The OPanel server only calls Console's confidential `/api/integrations/opanel/v1/{exchange,entitlement}/` routes. Customers start via entitled Console service and OPanel `/auth/start/?service_id=...`.
6. Test single-use PKCE code, fixed redirect, wrong customer/service, expired/suspended hosting, stale provider binding, replay, rotated supplier config and Console outage. OPanel must establish its own cookie session, never a second Console commercial identity.
7. Real hosting operations require a separately certified isolated node, capability registry, backups and live vendor/native readback. The Source implementation is not a licence to turn on privileged account mutations.

## Brevo: owner preparation
1. Create a Brevo business account in the owner's company identity and generate a dedicated API key at the Brevo API key settings. Store it in an approved server-side secret manager, never in frontend source.
2. Authenticate the sending domain using the **exact DNS record values shown in Brevo** (do not copy example values). Verify company sender mailbox.
3. API base: `https://api.brevo.com/v3`; minimal read-only credential preflight is authenticated `GET /v3/account`. Transactional send endpoint: `POST /v3/smtp/email`; delivery webhooks require an authenticated, replay-safe endpoint before activation.
4. Admin: `/admin/integrations?provider=brevo` (requirements and status) then `/admin/settings/mail` for approved mail policy/template defaults. Neither is permission to paste an API key into an unqualified legacy editor.
5. Test templates (welcome, password reset, invoice, renewal), only approved sender, no recipient data leakage, bounded retries/deduplication, bounce/suppression, SPF/DKIM/DMARC, webhook authenticity and failure classification. Verify actual inbox delivery with controlled recipients.
6. Brevo transactional mail is **not** hosted customer email/IMAP/POP mailbox provisioning; use a separate mailbox hosting supplier if sold as a product.

## Security and commercial gates
- Public legal pages reviewed by counsel and NDPC obligations addressed; no implicit acceptance, documented retention, DSAR/incident contacts.
- Paystack/approved gateway signature, backend lookup, amount/currency/merchant reference verification, replay suppression, refund reconciliation and bank settlement ledger; callbacks do not mark paid.
- Supplier reseller entitlements; DirectAdmin restricted Login Key, WHM least-privilege token; exact owner/domain/package readback after idempotent provisioning.
- Catalogue published offer version/valid supplier costs; domain registrar authority and ICANN ownership/transfer controls.
- Production secrets protected with MFA step-up, external KMS/HSM, egress allowlist, audit integrity, recovery.
- OPanel independent native worker security: UID/mount/OS isolation, mTLS, node enrollment/revocation, encrypted backups, restore drills and accountable capacity.
- Exact-SHA CI + Django check --deploy, live owner/Staff/Client browser acceptance including 401/403, responsive widths, accessibility, SLO/performance metrics, outage/rollback and recovery.
- Distinguish **technical pilot** (owned disposable domains/services, no public payment) from **paid public launch** (full commercial gates).
