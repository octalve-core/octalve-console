# HOST-FINAL-01 implementation evidence (2026-11-28)

Status: **incomplete; draft PR #182; do not merge or activate**. This file is not the completion register or HOST-FINAL-02 execution prompt. The approved README and BATCH-01-EXECUTION remain authoritative.

## Implemented code in this draft

- Shared account-bound resource authority uses the existing signed vault policy, provider readback, service ownership and entitlement, bounded request budget, and fixed pinned TLS transport. Global native resources switch defaults off.
- DirectAdmin and WHM: primary-domain mailbox inventory and create contract; primary-domain subdomain inventory. Supplier authentication derives account identity from the verified Service rather than browser input. The mailbox form requires the current Console password and persists no supplier or mailbox passwords.
- Before creation, check live capacity, reserve durable operation identity on the existing Service row, and only confirm existence/quota after independent supplier inventory. Ambiguous dispatch blocks another mutation; reconciliation does not repeat the write. Audit entries are redacted.
- Customer resource overview and native resource panel, signed per-supplier capability controls, resource usage counters (mailbox/database/subdomain) using existing ServiceUsage snapshots; absent/invalid counts are not displayed as zero.
- Synthetic tests for tenant isolation, disabled capabilities, quota, ambiguous replies, replay, fixed command scope, duplicate JSON, and optional usage counts. Both full CI workflow test lists include resource regression. No schema migration.

## Continuation: mailbox lifecycle and additional resource inventory

- Added mailbox deletion and quota changes for both supplier adapters, and actual DirectAdmin subdomain create/remove. DirectAdmin removal explicitly preserves directory contents. These operations use the existing durable service fence, exact target confirmation for deletion, live account limits for creation and independent inventory readback.
- Added mailbox password change for both suppliers, with distinct password authentication readback. A keyed operation-specific verification receipt is retained only for uncertain recovery, then erased on confirmation; no plaintext password is stored. Recovery verifies the originally submitted password without reissuing the write. Current Console password is required.
- Added customer database inventory for both adapters; only validated account-prefixed database names are displayed. Database creation, deletion, users and grants are not implemented by this addition.
- Expanded customer resource forms and Integration Store capability selections, with strict operation-specific authorization. WHM subdomain mutation remains refused pending a supported contract and safe document-root verification.
- Previous revision 9843c665 passed both CI workflows (46135369250 and 46135369332). This is not evidence of the newer revision passing. Latest full CI and browser qualification remain required.

Additional official references:
- DirectAdmin legacy API (including POP modification quota units, subdomain removal): https://docs.directadmin.com/developer/api/legacy-api.html
- DirectAdmin email password verification: https://docs.directadmin.com/changelog/version-1.26.0.html
- cPanel password verification: https://support.cpanel.net/hc/en-us/articles/360049827494-How-to-validate-an-email-password-using-the-cPanel-API
- cPanel password change: https://support.cpanel.net/hc/en-us/articles/360059062534-How-To-Reset-E-mail-User-Passwords-via-the-command-line
- cPanel subdomain removal: https://api.docs.cpanel.net/cpanel-api-2/cpanel-api-2-modules-subdomain/cpanel-api-2-functions-subdomain-delsubdomain (deprecated API2; official page states no UAPI equivalent; do not invent a substitute).
- DirectAdmin database inventory: https://docs.directadmin.com/changelog/version-1.21.2.html

## Supplier contract references and qualification limits

- DirectAdmin official legacy API: https://docs.directadmin.com/developer/api/legacy-api.html
- DirectAdmin impersonation and API access: https://docs.directadmin.com/developer/api/
- DirectAdmin state-changing POP requests must be POST from version 1.685: https://docs.directadmin.com/changelog/version-1.685.html
- cPanel WHM API execution: https://api.docs.cpanel.net/specifications/whm.openapi/api-execution
- cPanel Email add_pop: https://api.docs.cpanel.net/specifications/cpanel.openapi/email-accounts/email-add_pop
- cPanel StatsBar reference: https://api.docs.cpanel.net/cpanel-api-2/cpanel-api-2-modules-statsbar/cpanel-api-2-functions-statsbar-stat (legacy reference recommends UAPI; no deprecated API2 execution).

Synthetic fixtures are not real supplier compatibility evidence. DirectAdmin full_list JSON shape/empty inventory and quota representation must be checked against the supported server versions. WHM UAPI bridge documentation describes GET; password-bearing mutations deliberately use POST form bodies to avoid query-string credentials. Confirm supported bridge POST behavior before enabling; do not fall back to a credential-bearing GET. Exact UAPI response shapes, access control and quotas must be tested against supported versions. Current policy selection is an administrator authorization, not automatic supplier capability certification. Changing signed policy changes the account binding digest; requalification must be handled before enabling on existing accounts.

## Continuation: database lifecycle, cPanel subdomains, hosting credentials and forwarding

- Both adapters now implement database creation/deletion, user inventory/create/remove and explicit restricted database privilege profiles. DirectAdmin creation requires an initial user and password, while cPanel users are created separately. Account prefixes, existing user collision checks, capacity, scope, and independent existence/grant readback are enforced. New database-user password authentication is not independently verified; password reset and scoped advanced-manager access remain outstanding.
- cPanel subdomain creation uses the UAPI operation and removal uses narrowly scoped legacy API2 because the supplier documents no UAPI equivalent. The fixed document-root policy and independent inventory/root confirmation must be verified on supported supplier versions.
- Hosting account password reset uses exact reseller account scope and independent authentication. DirectAdmin uses its verification command; cPanel uses the pinned host's fixed TLS port 2083 endpoint with the customer credential. No credential-bearing URLs, plaintext password retention or blind mutation retry.
- Forwarding allows a single external email destination for an existing primary-domain mailbox. Special forwarding targets, multiple destinations and local chains are not modified. DirectAdmin uses its legacy API, cPanel uses UAPI mutations with explicit API2 inventory field orientation. Vendor version/empty-response qualification remains mandatory. New synthetic tests cover exact readback and cross-account denial.
- Both CI workflows passed on c192ce5a (46137704537, 46137704536). Forwarder revision c575c052 is a newer revision; do not reuse earlier green checks as its qualification.

References: https://docs.directadmin.com/changelog/version-1.22.3.html ; https://support.cpanel.net/hc/en-us/articles/360061940414-How-to-add-an-email-forwarder-in-the-command-line-using-UAPI ; https://support.cpanel.net/hc/en-us/articles/14086688144023-How-to-delete-an-email-forwarder-with-the-API ; https://api.docs.cpanel.net/cpanel-api-2/cpanel-api-2-modules-email/cpanel-api-2-functions-email-listforwards .

## Outstanding release blockers

| Scope | Remaining |
|---|---|
| Email | Autoresponders, secure webmail and supplier-confirmed IMAP/SMTP settings; single external mailbox forwarding now coded, requires latest CI and supplier qualification |
| DNS | Authoritative inventory and CRUD, record validation, signed domain authority and new explicit write consent; existing Cloudflare DNS binding is read-only and must not be silently escalated |
| Subdomains | Both adapters coded; qualify actual vendor versions, document-root behavior and independent DNS/TLS readiness |
| Databases | Database/user CRUD and restricted grants coded; user password reset, scoped advanced manager and supplier qualification remain |
| Files | Safe directory/file operations, transfer limits, traversal protections and scoped advanced manager |
| Password/SSO | Hosting password reset and independent authentication coded; actual supported-version acceptance and credential connection details remain |
| Usage/readiness | Supplier count contract validation, SSL, backups and honest readiness; capacity and scheduling qualification |
| UI | All outstanding operation forms, integrated responsive browser and accessibility qualification |
| Supplier controls | Actual capability readback/acceptance and safe revocation/requalification, controlled operator recovery of unresolved mutations |
| Release | Latest head all CI, full end-to-end acceptance and security review, merge, both production deployments READY and smoke evidence |

Do not generate Batch 2 prompt until the complete Batch 1 release gate passes. PR #180 remains separate. No real supplier mutation, production schema change, commercial activation or deployment is authorized by this draft.

## Continuation: read-only autoresponder inventory

Added a signed, separately authorized autoresponder inventory for both hosting adapters, wired into the existing owning-service API and customer resource tab. Only addresses are returned; message text, subjects and CC destinations are not exposed. Fixed transport disallows writes and out-of-domain queries. DirectAdmin empty raw replies are refused until qualified. cPanel uses Email::list_auto_responders. Synthetic tests cover invalid domain, duplicated identities, malformed legacy replies and permission dependencies. Latest CI and supported supplier version qualification remain outstanding. Creation, editing, deletion, schedule/message verification and webmail remain incomplete; this is not a release.

References: https://docs.directadmin.com/changelog/version-1.21.3.html ; https://api.docs.cpanel.net/specifications/cpanel.openapi/email-accounts/email-list_auto_responders .

## Continuation: exact autoresponder removal

Added explicitly confirmed removal on both supplier adapters, behind a separate signed capability and the existing durable service fence. No mailbox deletion or responder creation is sent. The resource must appear in supplier inventory before removal; confirmed absence is required afterward. A DirectAdmin empty response without explicit status stays uncertain rather than falsely reporting the last responder removed. Added customer removal form, negative transport tests and service API regression. Creation and editing remain unfinished. Supplier version acceptance and latest CI remain release gates.

## Autoresponder write continuation

Both suppliers have bounded plain-text create operations with fixed 48-hour interval, no CC, HTML, template substitution or customer-chosen schedule; DirectAdmin has a narrowly scoped edit contract. Content readback must match an event-keyed receipt, not just address existence. cPanel support confirms no documented atomic edit API (https://support.cpanel.net/hc/en-us/community/posts/30365048362903-Autoresponder-via-CLI); no silent delete/recreate is performed. cPanel edit and supplier-version qualification remain outstanding. DirectAdmin contract: https://docs.directadmin.com/changelog/version-1.49.0.html ; cPanel readback: https://api.docs.cpanel.net/openapi/cpanel/operation/get_auto_responder/ .

## Secure email access continuation

Added cPanel mailbox-specific secure client settings via Email::get_client_settings, restricted to the exact pinned supplier hostname and implicit TLS ports 993/465, plus WHM mailbox-scoped webmaild session launch with Console password confirmation, no-cache response, short supplier expiry validation and exact origin/port/session identity. Other mail host layouts fail closed. DirectAdmin's Roundcube flow is IP-bound and form-based; it remains outstanding, as does DA mail configuration readback. No supplier traffic was sent. References: https://api.docs.cpanel.net/openapi/cpanel/operation/get_client_settings/ ; https://api.docs.cpanel.net/guides/guide-to-api-authentication/guide-to-api-authentication-single-sign-on ; https://docs.directadmin.com/other-hosting-services/webmail/ .

### Database password protocol and secret-handling hardening

- Fixed DA `CMD_API_DB_USER action=modify` and cPanel `Mysql::set_password` dispatch contracts, exact account prefix and membership checks, explicit cPanel empty failure list requirement, no generic command proxy. Contract tests use synthetic responses only. No customer route/capability: independent MySQL authentication proof, durable reconciliation and supplier acceptance remain missing. ACK is not a verified reset.
- Redact autoresponder content from debug locals; reject duplicate WHM session JSON fields; restrict webmail-specific session syntax to that service.
- Official references: https://docs.directadmin.com/changelog/version-1.25.1.html ; https://api.docs.cpanel.net/cpanel-api-2/cpanel-api-2-modules-mysqlfe/cpanel-api-2-functions-mysqlfe-changedbuserpassword .

## Revised hybrid dashboard scope (owner approval 2026-11-28)

The owner approved the WHMCS-inspired compact dashboard and safe supplier panel fallback for unsupported or unqualified advanced operations. The overview now uses real stored billing and usage, exact owned domain routing, a shortcut grid and lazy resource tools, existing quick-mailbox creation with quota and Console password confirmation, existing renewals and cancellation routes, collapsed readiness and no invented supplier paths. All advanced shortcuts explicitly open the assigned supplier panel root, not an asserted deep link. Native resource operations and safeguards remain intact. Supplier policy and vault are rechecked after minting panel sessions. No DNS write permission is enabled; dedicated authoritative DNS write authorization, native file isolation, DB password authentication and SSL/backup readiness remain separately tracked until qualified. No real supplier traffic.

### Public DNS delegation observation

Added independent, bounded TLS-only Google and Cloudflare public recursive NS observations for any owned active domain, exact query and answer validation, disagreement handling, current tenant recheck, optional comparison with an independently authorized live Cloudflare zone, and operator/customer UI. This is public delegation evidence, not direct authoritative-server proof or DNS mutation permission. Existing read-only token and consent stay unchanged. No supplier traffic during tests. Docs: https://developers.google.com/speed/public-dns/docs/doh/json and https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/ .
