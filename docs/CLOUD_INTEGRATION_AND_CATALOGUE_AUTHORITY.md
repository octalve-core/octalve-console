# Integration and catalogue authority

Super Admin enters supplier credentials in the Integration Store. The API-owned schemas define the fields and secrets. The vault requires the verified operator, password, fresh authenticator code, PostgreSQL audit protection, and independent encryption key custody. Supplier secrets are encrypted, versioned and written without returning their values to the browser. A deployment list of provider slugs is no longer required. The old `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS` variable has no effect.

Verification and activation use provider-specific APIs. The Console currently verifies Paystack, Brevo, Cloudflare DNS and Cloudflare Registrar Sandbox through the general Verify action. The separate live registrar quote action reads supplier data. The Paystack side sheet exposes the existing explicit test gateway binding after verification. It references the vault version. It does not turn on live payment collection. Other schema-backed editors store encrypted credentials while their operating adapters are pending. Google Workspace and Microsoft 365 need their respective OAuth/consent flows. Let's Encrypt is an ACME workflow with domain validation and client-managed account keys.

## Deployment configuration responsibilities

| Configuration | Responsibility |
| --- | --- |
| Django secret, database URL, Console/API origins and trusted ingress policy | Platform-level deployment configuration. Preserve the established Production project and database. |
| Vault, audit, authenticator and recovery keys, key IDs and rotation settings | Infrastructure custody. Preserve current key material and versions. |
| Provider vault approval, custody and write switches | Global vault protection. The Integration Store displays failed readiness checks without disclosing values. |
| Pinned hosts, network egress and worker capabilities | Infrastructure policy. A saved provider URL cannot override host or port policy. |
| Paystack test binding switch | Available by default under the existing vault checks. An explicitly configured false remains an emergency disable switch. |
| Hosted checkout, gateway readback and signed webhook ingress | Separate payment transports. Production must use the right callback and provider webhook scope. |
| Live settlement, hosting provisioning, registrar execution and DNS writes | Separate operational permissions. Credential storage and verification do not authorize these actions. |
| Production sandbox purchase parameters | Existing operator pilot configuration. This release does not move the pilot account, domain or registrant profile into Console yet. |

## Retail pricing

The hosting catalogue manages supplier package evidence, products, plans, billing cycles and immutable published offers. Domain TLD pricing is linked from that workbench and uses one editor and one API for registration, renewal and transfer rates. Do not represent a TLD as a hosting plan. Editing an active TLD stores the new draft without overwriting public rates. Sandbox domain quotes consume the saved draft and pin the accepted draft revision to the order. A live domain product still needs supplier-backed quote and publication authority.
