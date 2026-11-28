# HOST-FINAL-01 implementation evidence (2026-11-28)

Status: **incomplete; draft PR #182; do not merge or activate**. This file is not the completion register or HOST-FINAL-02 execution prompt. The approved README and BATCH-01-EXECUTION remain authoritative.

## Implemented code in this draft

- Shared account-bound resource authority uses the existing signed vault policy, provider readback, service ownership and entitlement, bounded request budget, and fixed pinned TLS transport. Global native resources switch defaults off.
- DirectAdmin and WHM: primary-domain mailbox inventory and create contract; primary-domain subdomain inventory. Supplier authentication derives account identity from the verified Service rather than browser input. The mailbox form requires the current Console password and persists no supplier or mailbox passwords.
- Before creation, check live capacity, reserve durable operation identity on the existing Service row, and only confirm existence/quota after independent supplier inventory. Ambiguous dispatch blocks another mutation; reconciliation does not repeat the write. Audit entries are redacted.
- Customer resource overview and native resource panel, signed per-supplier capability controls, resource usage counters (mailbox/database/subdomain) using existing ServiceUsage snapshots; absent/invalid counts are not displayed as zero.
- Synthetic tests for tenant isolation, disabled capabilities, quota, ambiguous replies, replay, fixed command scope, duplicate JSON, and optional usage counts. Both full CI workflow test lists include resource regression. No schema migration.

## Supplier contract references and qualification limits

- DirectAdmin official legacy API: https://docs.directadmin.com/developer/api/legacy-api.html
- DirectAdmin impersonation and API access: https://docs.directadmin.com/developer/api/
- DirectAdmin state-changing POP requests must be POST from version 1.685: https://docs.directadmin.com/changelog/version-1.685.html
- cPanel WHM API execution: https://api.docs.cpanel.net/specifications/whm.openapi/api-execution
- cPanel Email add_pop: https://api.docs.cpanel.net/specifications/cpanel.openapi/email-accounts/email-add_pop
- cPanel StatsBar reference: https://api.docs.cpanel.net/cpanel-api-2/cpanel-api-2-modules-statsbar/cpanel-api-2-functions-statsbar-stat (legacy reference recommends UAPI; no deprecated API2 execution).

Synthetic fixtures are not real supplier compatibility evidence. DirectAdmin full_list JSON shape/empty inventory and quota representation must be checked against the supported server versions. WHM UAPI bridge documentation describes GET; password-bearing mutations deliberately use POST form bodies to avoid query-string credentials. Confirm supported bridge POST behavior before enabling; do not fall back to a credential-bearing GET. Exact UAPI response shapes, access control and quotas must be tested against supported versions. Current policy selection is an administrator authorization, not automatic supplier capability certification. Changing signed policy changes the account binding digest; requalification must be handled before enabling on existing accounts.

## Outstanding release blockers

| Scope | Remaining |
|---|---|
| Email | Delete/password/quota changes, forwarding/autoresponder, webmail, verified IMAP/SMTP; explicit supplier acceptance and safe uncertain-operation recovery |
| DNS | Authoritative inventory and CRUD, record validation, signed domain authority, existing Cloudflare integration routing; no local-only or speculative DNS changes |
| Subdomains | Create/remove/document-root policy and independent DNS/TLS readiness |
| Databases | Database/user inventory, CRUD, grants, scoped manager |
| Files | Safe directory/file operations, transfer limits, traversal protections and scoped advanced manager |
| Password/SSO | Hosting password setup/reset and new cross-adapter acceptance; no credentials exposed |
| Usage/readiness | Supplier count contract validation, SSL, backups and honest readiness; capacity and scheduling qualification |
| UI | All outstanding operation forms, integrated responsive browser and accessibility qualification |
| Supplier controls | Actual capability readback/acceptance and safe revocation/requalification, controlled operator recovery of unresolved mutations |
| Release | Latest head all CI, full end-to-end acceptance and security review, merge, both production deployments READY and smoke evidence |

Do not generate Batch 2 prompt until the complete Batch 1 release gate passes. PR #180 remains separate. No real supplier mutation, production schema change, commercial activation or deployment is authorized by this draft.
