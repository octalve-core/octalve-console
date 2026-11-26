# Public website integration qualification

Console baseline: 45b7f810511770a8a9163ac7d706515c0cb89903.
Public website reference: 91164463882f36a605bd4522325873d7c716e766.

| Batch | Reuse | Qualification boundary |
| --- | --- | --- |
| 01 | IntegrationConnection, version-bound vault, step-up, audit chain, registrar readback | A fixed-origin Google Web Risk adapter can reuse the vault. AI and PageSpeed require separate provider authorization and operational limits. |
| 02 | Storefront document templates, canonical catalogue and registrar lookup | Templates remain drafts. AI model, provider quota and safe response contracts require qualification before enabling an anonymous paid workload. |
| 03 | Supplier egress policies, existing website Web Risk contract | Web Risk is reputation only. The target receives no request from this API. Direct SSL/redirect inspection would need dedicated bounded DNS and connection enforcement. |
| 04 | Published TLD prices, longest suffix matching, Cloudflare readback, domain bundle draft cart import, checkout, invoices and payment gates | The baseline bulk intent imports verified selections. Public bulk response, additional registry periods, registrar production purchases and pricing revalidation require separate qualification. |
| 05 | API liveness probe | Liveness does not establish service health. Public status has no independent monitoring evidence and must report unknown. |
| 06 | Proxy sanitization, commerce intent validator, backend-generated callback and hosted checkout allowlists | Require canonical Console URL and allowlisted payment-return paths. Preserve authenticated ownership, CSRF and existing role checks. |
| 07 | Public plans/categories and client-visible published KnowledgeArticle routes | Stable slugs and article metadata already exist. Revision history and related service links need a deliberate schema and publication workflow. |
| 08 | Existing CI, production build, PostgreSQL migration and encrypted backup gates | No schema change in this increment. Provider configuration and live provider verification must precede enablement. |

References: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Google Web Risk Lookup API](https://cloud.google.com/web-risk/docs/lookup-api), [Google PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started).


## Operator setup for Web Risk

1. In Google Cloud, enable Web Risk and restrict a dedicated key to that API. Set a project quota and billing controls appropriate to the expected traffic.
2. In Console Integration Store under DNS & SSL, save the key in a live Google Web Risk connection and run the authenticated readback check. The credential stays in the existing encrypted, versioned vault.
3. On the API project only, set CLOUD_PUBLIC_WEB_RISK_CONNECTION_ID to the verified connection ID and CLOUD_PUBLIC_WEB_RISK_CREDENTIAL_VERSION to the verified active version. Enable CLOUD_PUBLIC_WEB_RISK_ENABLED after reviewing the provider receipt and quota. Rotation or revocation stops the prior pinned version from serving requests.
4. Configure the storefront build variable NEXT_PUBLIC_OCTALVE_SECURITY_ENDPOINT with https://api.cloud.octalve.com/api/storefront/tools/web-risk/. It is a public URL, not a secret. The storefront repository requires no code change for this contract.

The API sends the URL as data to a fixed Google HTTPS origin. It does not request the submitted URL or follow redirects. Its shared budget permits at most 100 attempts per 24-hour window, in addition to an anonymous application throttle. The public status endpoint returns unknown until independent monitoring evidence is available. Neither endpoint changes commerce gates.
