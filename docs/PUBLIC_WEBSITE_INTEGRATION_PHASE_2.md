# Phase 2 public integration qualification

Baseline `e23214c4a2bcc42d6594d38690f6fa40a0bd436c`. Storefront reference `91164463882f36a605bd4522325873d7c716e766`.

## Public API contracts

Tool endpoints accept JSON POSTs under `https://api.cloud.octalve.com/api/storefront/tools/`. Responses are no-store. Invalid input returns 400, application or shared budget rejection returns 429, and unavailable or disabled services return 503. Provider errors and raw upstream payloads stay server-side.

| Path | Request | Successful response |
| --- | --- | --- |
| `domain-ideas/` | `{business,extension,count}`, count 1–100 | `{ideas: string[]}`, up to 30 fully qualified suggestions |
| `document-draft/` | `{kind,business,website,email,country,notes?}`, kind privacy, terms or cookie | `{kind,draft:true,text}`, plain text for review |
| `recommendations/` | `{need}` | `{plans: [...]}`, up to three current published plan records |
| `pagespeed/` | `{url,strategy}`, mobile or desktop | `{url,strategy,provider:"google-pagespeed",performance_score}`, integer 0–100 |
| `ssl/` | `{url}`, HTTPS | `{host,certificate_verified:true,expires_at,tls}` |
| `redirects/` | `{url}`, HTTP or HTTPS | `{hops:[{url,status}],final_url}`, HEAD observations only |

The existing GET `/api/storefront/status/` returns `{status:"unknown",monitoring_available:false}` until the independent feed is configured and valid. An available summary adds `events:[{id,title,status,kind,updated_at}]`. The feed supplies current incidents and scheduled maintenance. It does not supply uptime or incident history.

## Configure only after independent verification

- In Integration Store, save separate live Google Gemini and Google PageSpeed Insights connections. Restrict each key to its Google API and set supplier quotas. The Gemini verification action checks model metadata. A separately approved generation canary is required before public activation. PageSpeed verification requests a single example.com report.
- In API production settings, pin each verified connection ID and credential version with `CLOUD_PUBLIC_GEMINI_CONNECTION_ID`, `CLOUD_PUBLIC_GEMINI_CREDENTIAL_VERSION`, and the equivalent `CLOUD_PUBLIC_PAGESPEED_` variables. Enable with the respective `_ENABLED` flag after qualification. Daily shared allowances are 60 Gemini calls and 40 PageSpeed calls.
- Set storefront build variables `NEXT_PUBLIC_OCTALVE_GENERATOR_ENDPOINT` and `NEXT_PUBLIC_OCTALVE_DOCUMENT_ENDPOINT` to the domain-ideas and document-draft URLs. The other routes currently have no storefront adapter. Cookie is supported by the API while the current storefront document screens use privacy and terms.
- Enable `CLOUD_PUBLIC_SITE_INSPECTION_ENABLED` only after production egress qualification. Both inspection routes share 80 attempts per 24 hours. The TLS and HEAD transport resolves both address families, rejects mixed/private results, pins the connection to the vetted numeric address, and verifies the certificate against the original hostname. Every followed redirect uses a new validation and resolution. PageSpeed separately delegates website fetches to Google.
- Point `CLOUD_INDEPENDENT_STATUS_SUBDOMAIN` and `CLOUD_INDEPENDENT_STATUS_PAGE_ID` to the controlled public Atlassian Statuspage backed by independent monitors. Operator setup and a genuine outage/maintenance exercise are needed before implying operational coverage.

## Release boundaries

No schema change in this release. Knowledge-base revision history and related services need a schema and recovery qualification. Publication permissions and public draft exclusion remain in the existing code and tests.

The storefront performs bounded parallel requests to the existing single-domain endpoint, and its bundle handoff accepts up to four unique names. Admin multi-year values are draft rate-card metadata. They must not be published as registry-supported terms without a matching supplier quote and qualified checkout. Independent registrar purchasing, payments and provisioning qualification is still required.

Sources: [Gemini model catalogue](https://ai.google.dev/gemini-api/docs/models), [PageSpeed Insights](https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed), [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Statuspage summary contract](https://status.atlassian.com/api).
