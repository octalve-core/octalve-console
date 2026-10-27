# Octalve Cloud — A1 non-routing Admin preparation (source-only gate)
Baseline: `a75e6b5ec436df25a9ac6ba82fc6b36e9e945e1d`; execution issue: https://github.com/octalve-core/octalve-console/issues/54.

This limited batch can be safely reviewed without representing source tests as a completed browser walkthrough. The user requested A0's continuous browser-only journey first, but this assistant has no authenticated browser session and its local Chromium runtime could not resolve the live Console. A0 therefore remains **NOT DONE**, and A1 cannot receive full browser qualification.

## Code refactor scope
- Split the former shared admin editor configuration into 9 independent resource modules under `frontend/src/features/admin/data/editor-config/`, each retaining the original field names, labels, API mapping, route names and status semantics. Keep a typed `admin-editor-config.ts` compatibility barrel for existing consumers.
- Extract the generic form presentation into `AdminResourceEditorForm.tsx`, leaving exact-ID edit authorization, touched-field PATCH submission, error parsing and API invocation in the original editor view.
- Remove developer-only sidebar ("Field validation ready", serializer notes, resource IDs) and redundant create-again links. Preserve Back, Cancel and Save as the same user actions.
- Add focused source checks for module boundaries, secret masking, unchanged authorization checks and production copy.

## Not touched
No Admin URLs, sidebar routing, provider adapter implementation, Django view, database, credentials, payment/financial actions, Console-OPanel boundaries, or live deployment. The generic provider create form is **still not the approved future Integration Store**; do not enter Production credentials into it until the B security gate.

## Forward gates
1. A0 browser walkthrough via actual authenticated clicking/typing and verified screenshots/trace, no direct URL jumps.
2. A1 source + visual acceptance for navigation, files/forms, and auth across normal user clickpaths.
3. A2 Integration Store grid and vendor-specific **requirements-only** side sheets with licensed official local logo assets, then B credentials / capability authorization in separate reviewed PRs.
4. Verify Production Vercel aliases/health before calling live release successful.
