# B2.3 — Pinned-IP HTTPS read-back and legacy host-executor closure
Date: 27 October 2026; issue #54. No Production supplier calls made.

## Why host allowlists alone were insufficient
The previous `providers.inventory.fetch_inventory` and `opanel_bridge.readback.verify_existing_account` used a hostname allowlist but let `requests.get` resolve the origin at call time. Rebinding the origin hostname or private-resolver hijacking could direct authenticated vendor requests to metadata/internal IPs. This transport now uses an explicit operator-maintained public address pin as its TCP destination while validating the original hostname in SNI, Host and TLS certificate.

## Change and safety boundary
- `CLOUD_SUPPLIER_PINNED_READBACK_ENABLED=false` default. A separate `CLOUD_SUPPLIER_PINNED_IPS_JSON` map must contain the exact approved hostname => globally routable public IP, and that name must also be in the existing `CLOUD_INVENTORY_ALLOWED_HOSTS`. No browser-supplied host, private IP, loopback, internal metadata target, CIDR, wildcard or redirect.
- urllib3 connection dials only the pinned literal IP; server_hostname and assert_hostname retain the approved domain. Enforced cert verification with OS-backed certifi CA roots, 15s maximum timeout, 1MB response cap and zero automatic redirects/retries.
- Only existing DirectAdmin/WHM **read-only** package-inventory and verified OPanel account-readback are wired. Old `BaseProviderAdapter` DirectAdmin/WHM executor refuses all methods (including writes) rather than bypassing payment/outbox/ownership authority.
- Mock-getter injection in existing backend unit tests remains for isolated synthetic acceptance; normal runtime uses pinned transport. No call happens unless the independent pin flag, existing inventory allowlist and supplier readback entitlement permit it.
- CI exercises public-IP pin, exact original TLS identity, redirect deny, TLS deny, response limit, dangerous hosts and blocked legacy POST with no actual external network.

## Outstanding certification
Actual DNS ownership/certificate deployment and approved static IP continuity on a real purchased VPS, network-level egress ACL / service mesh egress deny, mutual TLS where vendor provides it, rate/circuit breakers, supplier version pinning and separate DirectAdmin/WHM account-creation worker remain unqualified. Existing OPanel /payment/hosting flags stay default OFF. Real API credentials and customer provisioning must not be enabled yet.

References: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html , https://urllib3.readthedocs.io/en/stable/reference/urllib3.connectionpool.html , https://docs.python-requests.org/en/latest/user/advanced/#ssl-cert-verification .
