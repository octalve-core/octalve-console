# Octalve Cloud — A2 Integration Store and Admin navigation source qualification
Baseline `main` = `4e2e37a97705807d9865de3c0ac28f8c9c643af3`; reference https://github.com/octalve-core/octalve-console/issues/54.

## Safe implementation
- Adds one new protected Admin route `/admin/integrations`; new total 85 Admin pages / 135 Console route entry points and 810 planned viewport checks. All remain **browser-unqualified** until actual authenticated click journeys are recorded.
- Fixes existing broken Admin Catalogue/Category sidebar link (previously `/admin/category`) by pointing it at the existing `/admin/catalog/workbench`.
- Adds search, category filters and side-sheet information for 21 vendor connectors across Hosting, Domains, DNS & SSL, Payments, Business email, Cloud & VPS, and Storage. A provider card is a catalogue item, **not** a live provider account.
- Uses native modal dialog so background remains inert; Escape, Tab focus containment, close button and mobile full-height behaviour depend on browser native semantics. Browser acceptance must confirm actual behaviour.
- Every vendor has a specific HTTPS setup-guide link, requirement descriptions and limitations. No secret fields, HTML credential form or supplier API calls are included.
- Reuses local Simple Icons brand marks for 12 vendors (see `frontend/public/integrations/SOURCES.md`); missing marks use a neutral icon. Artwork is vendor identification, not an endorsement.
- Preserves existing /admin/servers list and read-only record views. Redirects former `/admin/servers/new` provider Save/edit shortcut to discovery; no existing database records deleted.
- Keeps payment gateways, catalog offers, provisioning queue, OPanel source authority and Django provider models unchanged. Does not enable live checkout, domain purchases or external server actions.
- Adds source CI guards for sidebar routes, catalogue definitions, local logos, no credential forms and old provider entry retirement.

## Known limitations and safety gates
**A0 browser-only walkthrough remains pending.** This environment does not have an authenticated browser session, and CI route inventory cannot substitute for screenshots/interactive evidence. Verify from public login by clicking visible links only and record role-correct viewports. Do not introduce real credentials, purchases or provisioning during review.
B — design and certify backend-secret lifecycle, MFA/RBAC, encrypted versioning, deny-by-default schema validation, egress host allowlists, SSRF/DNS rebinding controls, credential rotation, audit.
C — DirectAdmin/WHM provider provisioning and independent account readback.
D — OPanel dual-panel actual file/database/mail compatibility without copying a separate hosting account.
E–H — Domain/DNS, email/SSL, cloud/VPS, resilience and financial/commercial acceptance. All separately gated.

## Research sources
W3C modal dialog APG: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
DirectAdmin Login Keys: https://docs.directadmin.com/developer/api/
WHM API Tokens: https://docs.cpanel.net/whm/development/manage-api-tokens-in-whm/
ResellerClub: https://manage.resellerclub.com/kb/answer/753
Cloudflare: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
Paystack: https://support.paystack.com/en/articles/2123458
Zoho Partner: https://www.zoho.com/mail/help/api/organization-api.html
Microsoft Partner Center: https://learn.microsoft.com/en-us/partner-center/developer/get-started
Google Workspace Reseller: https://developers.google.com/workspace/admin/reseller/v1/how-tos/prerequisites
Simple Icons source/trademark disclaimer: https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md
