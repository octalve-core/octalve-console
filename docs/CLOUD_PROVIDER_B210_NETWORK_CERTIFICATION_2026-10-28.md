# B2.10 — Supplier egress request-contract hardening (source scope)

Baseline: PR #69 branch, following B2.8. No new network destinations, DNS resolutions, supplier credentials, VPS firewall changes, Vercel deployment or Production Neon operations.

## Finding and change
B2.3 already pins approved public-IP HTTPS to original-host SNI and certificate validation. However its reusable GET transport previously allowed arbitrary URL paths and header/query shapes on an approved hostname. If accidentally reused, an authenticated supplier token could access unreviewed API functions. B2.10 makes the outbound transport deny-by-default for all paths except the actual reviewed call sites:
- DirectAdmin GET /CMD_API_PACKAGES_USER: empty params or a single bounded package name.
- DirectAdmin GET /CMD_API_SHOW_USER_CONFIG: one strict account-name parameter.
- WHM GET /json-api/listpkgs: api.version=1, want=creatable only.
- WHM GET /json-api/accountsummary: api.version=1, one strict account name.
- Exact approved Accept and Authorization headers; no user-provided extra headers, CR/LF, arbitrary methods, redirect or unreviewed paths. Existing public-IP pin, TLS validation, 15s timeout and 1MB cap remain.

The new tests verify these negative cases without making a network call; safe existing DirectAdmin and WHM request shapes remain supported.

## Still not B2.10 *operational* certification
The network-level deny-default egress policy must be independently enforced at the real dedicated provider-worker/VPS or egress gateway; app-level checks alone cannot control a compromised process. A Vercel serverless function does not become a network firewall by calling this transport.

Operations need a verified hostname and public static IP for each permitted panel, authorized DNS/certificate ownership proof, approved exit IP, tight firewall outbound ports 2222/2087/443 as appropriate, no direct route to metadata/internal networks, IPv4/IPv6 negative probing, proxy bypass testing, known CA chain, pinned vendor version and expiry/renumbering procedure. Credentials should be dedicated least-privilege login keys and scoped WHM tokens, not root passwords. Test actual network deny with the firewall in place, not source mocks.

## Required acceptance
1. Security owner identifies and approves each supplier endpoint, fixed public IP and panel purpose; reject private/rfc1918/link-local/metadata routes and disallowed ports.
2. Deploy a dedicated isolated worker with deny-default security group/egress gateway/firewall. Require network-owner evidence for TCP allowed and disallowed destinations before any live token is used.
3. Verify DNS ownership and TLS hostname/certificate/expiry, token scopes, redirects/size limit, wrong IP/dropped certificate/timeout/429/5xx, emergency revocation and read-only inventory/account-summary behavior on authorized test panel.
4. Separate qualification of circuit breakers, retry/idempotency boundaries, connection attestations and monitoring; never treat an API 200 response as proof of a customer-owned service.
5. Production Neon, OPanel ownership and commercial provisioning remain unchanged; no provider credentials or customer provisioning enabled by this PR.

References:
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- https://docs.directadmin.com/developer/api/
- https://api.docs.cpanel.net/whm/introduction
