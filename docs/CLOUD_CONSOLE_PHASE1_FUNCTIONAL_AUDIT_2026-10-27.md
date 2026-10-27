# Octalve Cloud Console — Phase 1 functional and authority audit
Date: 27 October 2026. Base: `main` / `review/cloud` at `39797bce22414d9f57f8f6d62c85050c0e3fb469`.
Scope: frontend-only integrity safeguards, API truthfulness, action inventory, and regression tests. No backend migrations, financial writes, provider provisioning, or production deployment.

## Verified defects, changes and qualification

| ID | Evidence in source | Phase 1 correction | Qualification |
| --- | --- | --- | --- |
| UI-AUTH-01 | `admin-record-normalizer.ts` used `Math.random()` as a substitute ID for API records with no identifier. Details/editing could link to nonexistent records. | Require exact API identity; reject missing identifiers. | Deterministic Node regression; TypeScript and Next build in PR CI. |
| UI-AUTH-02 | `AdminResourceEditorView.tsx` originally hydrated edit fields from `AdminRecord` presentation values. For example `description` and `adapter_type` were set from `meta`, and balances/prices from formatted amounts. | Hydrate from exact raw row returned by the authorized loader, never from display projections. Require one exact record. | Source guard; full authenticated interaction still pending. |
| UI-AUTH-03 | Edit submit sent every prefilled field, even without intentional edits; possible stale/incorrect PATCH values. | Submit only explicitly changed, nonempty values in edit mode. Reject no-change submits; retain full create payload behavior. | Regression guard; Django serializer/role acceptance still required. |
| UI-AUTH-04 | Secret field prefill could be inferred if raw records are used. | Always blank password fields; only send explicitly typed secret values. | Source guard; Django storage and readback security still unverified. |
| UI-AUTH-05 | Payload mapper defaulted plan currency to NGN, gateway display name to name, and sent blank provider config on unrelated updates. | Do not synthesize those fields in PATCH input. Keep new-plan NGN UI default. | Source guard; backend schema and partial update integration need verification. |
| UI-AUTH-06 | `unwrapAdminList` silently mapped unrecognized response shapes to empty lists. | Fail with explicit error for invalid list envelopes / rows instead of presenting “no records”. | Deterministic Node regression. |
| UI-UX-01 | The edit page's query-mode boot initially appeared as create before URL interpretation, and saves used delayed navigation / engineering wording. | Hold editor in loading state until query mode is read; navigate after the real API promise resolves; use customer-safe error wording. | Source guard; live browser testing still outstanding. |

## Protected boundaries
- Django is the authoritative source for authentication, tenant/record-level RBAC, payments, domain ownership, pricing, orders, invoice transitions, provider and OPanel entitlement decisions. Client gating is usability only, never authorization.
- Unsupported actions must not claim success. No speculative backend method, provider adapter or writes were introduced.
- No production money movement, provider operation, external message or database modification executed by this phase.
- Existing Batch 8 stylesheet remains intact. Its retirement gate still blocks deletion pending 123-route x six viewport browser qualification.
- The raw record comes from the authorized API list, **not** a per-ID secure detail API. For paginated lists, an absent row fails closed. A dedicated server-side authorized detail endpoint and full verification belong in Phase 4.

## Phase 1 extended route/action inventory still required
The findings above are a targeted code audit, **not** certification of all 123 routes. Before calling Phase 1 complete, inspect all Client (23), Staff (10), Admin (83) and Public/Auth (7) routes:
1. Every displayed Create/Edit/Save/Delete/Retry/Download/Verify/Refresh action must have a real corresponding API call or clear unsupported state; no simulated success or sample records.
2. Check HTTP verbs, CSRF/session model, record ownership, server-side permissions and negative 401/403/404 behavior using isolated test identities. Never infer authorization from a role-gated React component.
3. Check invoice status, wallet, payment, service provisioning, domain/registrar operations using read-only and intentionally unpaid sandbox fixtures; no mutation tests on live customers.
4. Reconcile all form request fields against Django serializer contracts and response envelopes, especially nested configurations and optional-clear semantics. In particular, `buildPayload` currently does not support clearing a field to empty; server contracts should make this explicit.
5. Verify API errors, loading/retry, pagination and keyboard access in authenticated browsers, and preserve exact checkout/domain/api authority.
6. Track blocked/unconnected workspaces against the Phase 4 register, rather than pretending the API returned an empty account.

## Evidence and standards
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): deny by default, server-side ownership and action authorization.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html): HTTP method authorization, input validation, state transition protection and generic error handling.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): state changes must not be implemented via GET, and cookie sessions need CSRF defense.
- [OWASP ASVS 5.0.0](https://asvs.owasp.org/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/): acceptance baselines for security and keyboard/visual behavior.

Release decision: changes remain on an isolated Review PR until exact-head CI succeeds. Live role-correct browser acceptance and final CSS removal are independently unqualified.

## Phase 1 follow-on — cross-role list envelope truthfulness
- Admin Resource, Admin Operations and Admin Workspace list views now reuse the fail-closed authorized list parser rather than independently returning [] for invalid HTTP response envelopes.
- Client and Staff record list normalizers now reject malformed arrays/envelopes and invalid item types rather than displaying false “no records” states.
- Node regression checks empty authorized lists as valid but rejects null, missing results, non-array results and invalid array items for all three roles.
- This is a data-truthfulness UI guard; it does not replace Django tenant authorization or authenticate any browser session.
