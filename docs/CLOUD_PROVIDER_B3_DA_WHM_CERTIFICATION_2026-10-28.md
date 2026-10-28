# B3 — DirectAdmin and WHM read-only certification: synthetic source evidence

Source baseline: B2.10 review candidate. This batch adds synthetic certification fixtures for exactly the existing read-only supplier inventory and account-identity parsing workflows. It does NOT perform real provider login or vendor API calls and cannot be used as proof of live connectivity.

## Verified source contracts
- DirectAdmin: dedicated login-key Basic authorization on HTTPS 2222/443; GET CMD_API_PACKAGES_USER with empty params for list and single package name for details. Bounded resource-spec parsing. Existing account proof requires exact username, creator/owner, domain, active ON, correct usertype and no suspension.
- cPanel/WHM: dedicated scoped API token on HTTPS 2087/443; GET json-api/listpkgs with api.version=1 and want=creatable; strict metadata, package identifiers and resource limits. Account summary requires exact user, owner, domain and non-suspended status.
- Tests inject synthetic responses, prove only these approved read-only API paths are invoked, deny vendor error, malformed duplicate package, 403 and account owner mismatch. No fixture represents a real server.
- Neither successful inventory nor a successful account-summary alone authorizes a service. Console must independently verify service ownership, active status, settled payment/provisioning, live provider binding, and successful account readback before OPanel SSO. OPanel stays independent and customers keep their Console login.

## Real DirectAdmin/WHM acceptance — NOT complete
1. Independently authorize the real dedicated panel(s), hostnames, static public IPs, DNS/CA identity, outbound-only worker/VPS and firewall evidence required by B2.10.
2. Obtain least-privilege, provider-specific login key/token from the approved infrastructure owner. Restrict to approved API functions and source IP where supported; test expiration/revocation. Never use a root password or share a token in chat/GitHub.
3. First use an isolated owned test account and read-only package-list/detail. Log redacted request IDs, vendor version, certificate fingerprint, verified DNS/IP, HTTP status, response shape, latency/failure cause, expiration/circuit-breaker evidence. Verify 401,403,429,timeout,redirect,body-size,wrong-host,expired certificate and wrong token scenarios.
4. Test read-only existing-account identity (username, owner, domain, suspension) against an authorized, pre-created test account, without changing any customer record.
5. Only after B2.8 external retention, B2.9 actual KMS and phishing-resistant step-up, B2.10 network-level egress, and full recovery are externally accepted should vendor-specific credential-submission UI be enabled.
6. Provision, suspend, terminate or modify account settings ONLY under a separate later financial authority/outbox/idempotency/ownership review. There is currently no authorization for writes or actual customer provisioning.

Vendor documentation:
- https://docs.directadmin.com/developer/api/
- https://api.docs.cpanel.net/whm/introduction
- https://api.docs.cpanel.net/whm/tokens
