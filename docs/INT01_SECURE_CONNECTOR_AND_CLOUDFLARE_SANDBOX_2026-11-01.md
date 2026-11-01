# INT-01 — Secure Cloudflare DNS and Registrar Sandbox acceptance

## Scope and truthfulness
The INT-01 adapter is limited to the fixed HTTPS API at https://api.cloudflare.com/client/v4. It provides a read-only owned DNS-zone/records readback, Registrar Sandbox inventory and domain check, and a tightly restricted operator-only simulated registration. No production registrar purchase, customer Domain activation, DNS mutation, payment, supplier account, or auto-renewal can be triggered by INT-01. There are no user-supplied remote URLs, arbitrary methods or redirects. Sandbox registration creates a persistent TEST registration only: no real domain, DNS zone or billing.

No connected Cloudflare account credential was available at implementation. Passing CI with synthetic API responses is not actual vendor authentication evidence.

## Owner prerequisites
1. Cloudflare account ID (32 hex characters) and an owned active DNS zone ID (32 hex characters), for an already-owned real domain.
2. Scoped Cloudflare token with Zone Read and DNS Read permissions on that specific zone, not the Global API Key.
3. Different Cloudflare Registrar Sandbox API token with sandbox permissions, not a production registrar write token.
4. Accepted agreement and verified default registrant contact in the Cloudflare dashboard before optional simulated registration.
5. A secure isolated backend operator/worker with secrets in server-side secret manager, HTTPS egress to api.cloudflare.com and immutable audit-log storage.

## Private operator environment variables
INT01_CLOUDFLARE_ACCOUNT_ID — approved account ID.
INT01_CLOUDFLARE_DNS_TOKEN — private scoped DNS reader.
INT01_CLOUDFLARE_SANDBOX_TOKEN — private separate sandbox token.
INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED — unset by default. Literal true only on approved isolated operator; sandbox registration is disabled when VERCEL=1.
Never send tokens to chat, GitHub, client React, NEXT_PUBLIC values, logs or URL query parameters.

## Optional Admin live readback (read-only, independently enabled)
Set INT01_CLOUDFLARE_ADMIN_READBACK_ENABLED to literal true on the
Django API Production server only **after** secret-store approval.
For DNS readback also set INT01_CLOUDFLARE_ZONE_ID to the 32-hex
owned-zone ID. The Admin Integration Store → Cloudflare DNS / Registrar
side sheet then provides a Verify owned DNS zone or Verify Registrar
Sandbox button. Its GET /api/providers/int01/cloudflare/probe/?scope=dns|sandbox
is Super Admin-only, DB-rate-limited to 6/hour, requires backend-only
tokens, writes an AuditLog provider_connection_test receipt and never
creates domains, modifies DNS or returns credentials. If not configured
it returns 503 and does not pretend the supplier is connected.

The Registrar Sandbox **registration simulation** is deliberately
*not* accessible through this Admin view. It remains isolated and
operator-only as described below. A successful readback must not
automatically unlock any provisioning or registrar purchasing.

## Exact smoke commands, executed in the approved backend environment
- Read sandbox account: python manage.py int01_cloudflare_probe --scope sandbox
- Read owned DNS: python manage.py int01_cloudflare_probe --scope dns --zone-id YOUR32HEXZONEID
- Test sandbox availability: python manage.py int01_cloudflare_probe --scope sandbox --domain unique-test-name.com
- Only with explicit operator approval, isolated environment, accepted default contact and verified availability:
  INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED=true python manage.py int01_cloudflare_probe --scope sandbox --domain unique-test-name.com --simulate-registration --confirm-sandbox-only

Registration is restricted to .com/.net, exactly one year, redacted WHOIS, auto_renew false, one domain per request. A pending/202 response is unresolved, NOT a success; never retry automatically. Read back the unique domain before any subsequent action. Save non-secret timestamped receipts and keep provider request IDs in the infrastructure audit store.

## Acceptance / negative security gates
- Real sandbox authentication and registrar availability response, independently evidenced.
- Real owned DNS zone identity and account ownership, records digest plus comparison to authoritative public DNS.
- If approved: one sandbox domain registration confirmed by separate GET and zero real purchases, zero real DNS zones, zero payment.
- Fail closed for invalid IDs, path escape, private/metadata hosts, unapproved methods and endpoints, malformed provider payload, missing authorization, mismatched account/domain/registration status, redirects, TLS failure and oversized responses.
- Fixed TLS verification, no proxy credentials, strict timeout, streaming size cap, no payment credentials, no mutation of public Django Domain records, no auto retry of ambiguous registration outcomes.
- Full Django security/frontend/PostgreSQL CI and, after qualified main merge, Console/API exact Production SHA. Authenticated Admin/Staff/Client browser checks remain a separate acceptance gate.
- Clearly distinguish source-tested, configured, authenticated readback and live DNS propagation. No green connected label before real credentials and readbacks are certified.

## Current Admin position
Admin → Integrations → Cloudflare DNS or Cloudflare Registrar displays requirements, not a live credential-entry form. Production vault writes remain disabled by design; do not bypass MFA, audited key custody or provider egress controls to paste tokens into legacy Provider APIs. INT-01 live probe is an isolated operator command, not public self-service integration.

## INT-02 after readback
Deploy audited live connector certification, durable immutable evidence, KMS-backed token custody and rotation, Super Admin step-up, server egress, per-account permissions, explicit readiness state, then independently qualify live DNS changes and registrar writes. No real purchases/hosting provisioning are approved by INT-01.

Official documentation:
https://developers.cloudflare.com/api/resources/registrar_sandbox/
https://developers.cloudflare.com/api/resources/registrar_sandbox/subresources/registrations/methods/create/
https://developers.cloudflare.com/api/resources/zones/methods/list/
https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/list/
