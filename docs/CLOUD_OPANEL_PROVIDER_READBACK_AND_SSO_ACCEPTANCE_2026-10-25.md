# Octalve Cloud — controlled hosting-account read-back and OPanel SSO acceptance
Date: 25 October 2026
Status: DRAFT implementation; independent CI fixtures only. NOT qualified on a real DirectAdmin/WHM test server. No money, Production provider actions or hosting account creation.

## Authority and verification
Console owns customer identity and hosting-service entitlement. Only a verified provider account allows an OPanel session; OPanel has no second customer credentials. Provider usernames, passwords, tokens, WHM reseller credentials and host URLs stay server-side.

The new backend/operator-only `opanel_bridge.readback` module queries **one exact, already-existing account** on the service's recorded provider, using existing `providers.inventory._endpoint` TLS/host-allowlist checks:

- DirectAdmin: GET /CMD_API_SHOW_USER_CONFIG?user=<recorded hosting username>. Require error=0, exact username, main domain, usertype=user, account=ON and suspended=no.
- WHM API 1: GET /json-api/accountsummary?api.version=1&user=<recorded hosting username>. Require metadata.result=1, a single account in data.acct, exact user and domain, suspended=0.
- Both: exact HTTPS hostname on CLOUD_INVENTORY_ALLOWED_HOSTS, approved port, no redirects, validated TLS, 10-second timeout bound and 100KB response cap. No arbitrary browser account name or host overrides.
- Enforce provider active/healthy and non-test, service active/hosting/unexpired with activation timestamp, real existing provider account and primary domain.
- Dry run does not update DB. Explicit --apply creates/renews the private VerifiedHostingBinding only after matching readback and locked second eligibility check. On an attempted --apply with a negative provider response, old active proof is revoked immediately. Re-authorisation after revocation creates a NEW binding reference.
- Entitlement checks reject proofs older than **15 minutes** and require matching provider/account/domain digest; OPanel re-checks Console before each authorised request. This is a temporary fail-closed acceptance gate, NOT a substitute for a future provider-event/reconciliation worker.
- Neither readback nor any API creates hosting, pays invoices, or changes vendor resource state.

Official vendor documentation:
- https://docs.directadmin.com/developer/api/legacy-api.html (CMD_API_SHOW_USER_CONFIG)
- https://api.docs.cpanel.net/specifications/whm.openapi/account-management/accounts-accountsummary (WHM API 1)
- https://api.docs.cpanel.net/whm/tokens (scoped WHM API tokens)

## Before a genuinely live test (not yet done)
1. Qualify an isolated owned or authorised reseller test server, real test account and approved least-privilege read-only API token. Ensure operator access/contract, test DNS domain and verified domain ownership. Do not send secrets through chat, GitHub or browser storage.
2. Configure server-only Provider row using existing admin settings; encrypt token in existing credential store. Record its exact user/domain on a synthetic or expressly authorised test Service. Provisioning/payment authority is still disabled; do NOT misclassify a test fixture as a paid customer.
3. Restrict network egress to the approved endpoint. Hostname allowlisting does **not** by itself eliminate DNS rebinding, proxy redirects, malicious resolver results or internal-IP SSRF; inspect and enforce the deployment network boundary before setting OPANEL_READBACK_ENABLED=true.
4. In an isolated Review environment with secure environment variables only, set OPANEL_READBACK_ENABLED=true and CLOUD_INVENTORY_ALLOWED_HOSTS to the approved exact hostname. Never enable on Production based on CI fixtures alone.
5. From backend/ run `python manage.py check_hosting_account --service-id <fixture-id>` for remote read-only verification, inspect evidence, then explicitly run `python manage.py check_hosting_account --service-id <fixture-id> --apply` to persist verified proof. This does not create or alter the provider account.
6. Confirm idempotent same-account refresh, revoked/changed account reference, mismatched domain, removed account, provider API denial and suspension cases. Check **zero** unsafe credentials in application responses and logs.
7. Set up OPanel in a separate environment with independent database/session secret and matching fixed Console API, registered callback URL and dedicated shared client secret. Set OPANEL_ISSUER_ENABLED only after exact HTTPS DNS/certificate, audience and origin qualification.
8. Browser acceptance: authenticate only in Console, open exact owned active hosting service, click Manage hosting, verify secure code exchange and OPanel's independent cookie. Repeat with wrong owner, staff impersonation, expired/inactive/suspended/unprovisioned service, bad state/PKCE/replay, changed domain/binding, Console outage and sign-out.
9. Only after *all* gates pass may PR #13, PR #14, and OPanel PR #1 be individually qualified in dependency order. Do not bypass existing Production login/Preview-release gates.

## Current automated verification
- Django tests: `opanel_bridge.tests` and `opanel_bridge.test_readback` cover one-time grants, ownership, provider-only proof, exact DirectAdmin/WHM fixtures, failed response, invalid domain, suspension, revocation, proof expiry and the synthetic issuer-to-exchange sequence.
- The isolated OPanel PR has its own session, CSRF, expiry, callback and fail-closed test suite.
- No real HTTP requests to a provider are made during CI.
- `catalog.0002_catalog_offers` and `opanel_bridge.0001_initial` remain unpromoted migrations; historical Production schema must NOT be migrated until permitted.

## Not yet implemented (must be separate release)
- Reliable server-side payment settlement + worker outbox, idempotent provider createacct/DirectAdmin creation, account collision resolution, external account reconciliation and compensation/retry after ambiguous outcomes.
- Ongoing periodic provider read-back so customers do not depend on manual 15-minute evidence.
- Genuine account-scoped file/DNS/database/email APIs and finished Next.js OPanel workspace.
- Live end-to-end browser SSO with authorised server; all real provider test evidence.
- Production deploy, secure secret configuration and controlled browser verification.
