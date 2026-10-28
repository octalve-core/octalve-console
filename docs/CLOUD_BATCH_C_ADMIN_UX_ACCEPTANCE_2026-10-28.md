# Octalve Console — Batch C Admin UI authority acceptance

Date: 2026-10-28. Depends on draft Batch B PR #77 and Batch A PR #76. This is an intentionally stacked source-only review, not a Production release.

## Architectural ownership (approved)

| Area | Owner | Scope |
| --- | --- | --- |
| Settings | Octalve Console platform policy | Branding, access policy, billing/invoice defaults, customer messaging and non-secret display |
| Integrations | External connections | Connection registry, read-only provider status and security-gated credential custody; no direct Console policy editor for credentials |
| Provisioning | Authorized execution and reconciliation | Tasks, safe read-only sync transitions, ownership, verified supplier execution and audit evidence |
| Invoice designer | Versioned document presentation | Sample PDFs, read-only approved templates; never totals, issuance, financial state or settlement |
| Services | Customer entitlement | Verified status, OPanel eligibility, support, review-only cancellation until provider-confirmed changes |

## Changes

1. Shared `admin-action-policy.ts` mirrors fail-closed Django mutability without granting authority. Hide generic Create for invoices, orders, domains, gateways and provisioning. The older direct editor route and detail Edit action render a safe explanation rather than a false Save. Allowed customer/catalog editor paths are unchanged.
2. `AdminResourceAuthorityGuide` explains operational restrictions and offers verified navigation to Invoice Designer, Settings invoice policy, Integration Store and provider records.
3. Settings → Invoices now links directly to the existing server-authorized Invoice Designer; its studio links back to invoice records and policies. Template editing and actual invoice creation remain disabled; sample PDF is read-only.
4. Integration Store distinguishes a failed/unknown connection registry readback from a verified `Not connected` state. A retry is a **GET-only** refresh. Credential capture, vendor calls, execution and claim of connectivity remain prohibited.
5. The Client service details page can submit an explicit owner-scoped **cancellation review request** only after a separate confirmation. A successful response is accepted only if the server says `state=pending_review` and `provider_action_taken=false`. No hosting status, invoice, pricing or provider record changes from this interface.

## Source qualification

- `node frontend/scripts/check-batch-c-admin-actions.cjs` (added to frontend CI)
- Existing 85 Admin routes remain unchanged; the configured sidebar/navigation manifest is not rewritten.
- Existing Batch 7/9/16/18 UI source contracts, TypeScript, Next build and Django independent verification must stay green on the exact PR head.
- No credentials, settlements, invoice writes, automatic provisioning or Production migrations may be enabled to fix a UI issue.
- No authenticated screenshot/browser parity is implied by a CI result. A separately saved Admin/Client browser session and visual review are required before acceptance.

## Known next gates

- Server-advertised action capabilities (rather than a static frontend allowlist) once backend authority readback is accepted, including operator-level permissions.
- Approved Settings write workflow with genuine step-up authorization and immutable audit evidence.
- Verified provider-side credentials and adapter egress; separate DirectAdmin/WHM certification, recovery evidence and WORM/KMS custody.
- Invoice versioning and locked historical document snapshots; source preview alone is not PDF visual acceptance.
- Service cancellation life cycle with provider acknowledgement and financial reconciliation; the new request does not cancel hosting.
- Console login/session browser acceptance and responsive parity across Admin, Staff and Client roles.

## Research

- Next.js App Router server/client boundaries: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Django REST Framework permissions: https://www.django-rest-framework.org/api-guide/permissions/
- MDN native disabled versus ARIA-disabled controls: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled

## Release hold

PR #76 → PR #77 → PR #78 must be independently reviewed in order. `main` can auto-deploy both Vercel projects. No merge, promotion, Neon Production migration or live supplier execution without separate release authorization.
