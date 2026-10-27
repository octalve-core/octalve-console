# Octalve Cloud Console — Phase 1/2 user-reported Services and Domains failures
Date: 27 October 2026. Target baseline: `caf0f619a72ee73a93ccd3f44079c311799421bd`.

## Customer-visible evidence
The two screenshots show authenticated Console shells for /client/services and /client/domains. Both API-backed record sections display the same generic error. The independent domain search renders, and the sidebar/brand displays.

This does not establish a specific HTTP cause: screenshot-only evidence cannot distinguish 401, 403, 404, 500/502, timeout, invalid response or migration mismatch. There is no authorized production browser session or readable Vercel runtime log in this execution.

## Actual source findings and corrections
1. Both screens use `ClientResourceListView` and an authenticated Django read-only API via same-origin BFF. Django endpoint paths are `/api/services/services/` and `/api/domains/domains/`, with queryset restricted to the signed-in client. A valid empty list must be shown as empty, not an error.
2. Browser GET timeout was 12 seconds but BFF upstream timeout was 20 seconds. Changed browser GET deadline to 27 seconds so a slow upstream may complete. GET only; order and payment writes remain non-retried and without automatic abort.
3. Former error handling cleared records and showed a very large pink/red error box with no Retry. New state distinguishes session expiry (Sign in), permission denial, unavailability, timeout and unverifiable response, without echoing raw upstream errors.
4. Actual Try again repeats the original authorized loader; previously verified rows survive a failed quiet refresh. Last-response-wins protects against stale completion.
5. Phase 2 visual polish: reusable ErrorState/LoadingState rebuilt as compact, responsive, semantic Tailwind + Lucide surfaces in approved Console brand colors. Legacy global stylesheet is **unchanged** and must remain until all live browser parity passes.
6. New isolated Django acceptance asserts a registered client gets HTTP 200 + genuinely empty lists for both endpoints, and anonymous access is denied. New frontend CI ensures timeout hierarchy, error/retry connection and built Tailwind styles.

## Outstanding evidence — DO NOT assert Phase 1/2 complete
- Confirm exact HTTP status of both failing signed-in Production BFF requests (Network panel: request method/path/status ONLY; no Authorization, Cookie, account payload or PII). Inspect Vercel API and Console server logs under authorized access. If 500, check current Production DB schema ledger and ORM exception, after read-only identity preflight. Do not migrate based on screenshot alone.
- Test real Client, Staff and Admin sessions, all 123 routes at six viewport widths (738 cases), including empty/loaded/failed/expired/authz states. Current static manifest does not execute a browser or replace evidence.
- Audit remaining checkout, domain, specialized Admin and legacy CSS selectors; remove globals.css only once actual dependencies are zero and authenticated visual parity is accepted. Do not bypass `check-css-retirement-gates.cjs`.
- Reconcile actions/forms with Django serializers, pagination, provider/registrar capabilities and ticket/notification delivery. Backend integrations remain tracked in Phase 4, never simulated.
- Correct live upstream/Neon/provider problems only after confirming the actual failing status and permission/backup checks.

## Safety
No Django migrations, database writes, customer charges, external provider calls, DNS updates, CSS deletion, OPanel entitlement changes or passwords were performed by this batch. Use the owner-approved existing review/cloud -> CI -> main process. Check GitHub SHA and both Production deployments after merging.

References: Django REST Framework authenticated ViewSets, Next.js route handlers and the existing Console SHA-gated code acceptance.