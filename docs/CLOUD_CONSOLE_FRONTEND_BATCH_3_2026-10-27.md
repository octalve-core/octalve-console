# Octalve Console — Batch 3 Client Essentials
Baseline: `d1c7db8aa5fdd481c3064b2ec0f3199420a94feb`
Scope: Client Overview, Services, Domains, Profile and related Client-only display sections.

## Implementation
- Overview uses `ClientOverviewMetrics`, `ClientOverviewActions`, `ClientOverviewRecent`, each isolated under `features/client/components/`, with Tailwind, Lucide and Batch 1 primitives. The existing `useClientSummary` remains responsible for five independent API reads and accurate loading/unavailable states; no artificial zeros or fake customer records.
- Services and Domains list pages preserve the existing `clientResourceConfig` authoritative loaders and normalizer. Client-only `ClientEssentialRecords` provides search, status filtering, responsive native table/mobile cards, real record links and ten-row pagination. Other Client listing families retain their existing directory until Batches 4–5.
- Real service/domain detail pages keep existing ID/ownership-dependent record fetches and link destinations; `ClientEssentialDetail` provides presentation only. No inferred activity events or payment/provisioning claims.
- Domain search retains the original input alignment, guarded search form, abort behavior, lookup API call, registrar-based availability guard and cautious customer copy. Presentation composes `Panel`, `SectionHeading` and `StatusBadge`.
- Profile keeps the original `authApi.profile/saveProfile/requestEmailVerification/changePassword` calls, validation, personal input names, saved payload and refreshUser flow. New `ClientProfileDetailsForm` and `ClientProfileSecurity` are typed, responsive presentational sections.

## Hard exclusions
- No modifications to `backend/**`, Django authority, sessions, APIs, registered domains, payment/financial flows, provider configuration, infrastructure, frontend API hooks or shared Admin/Staff directories.
- No changes to `globals.css`; the Batch 0 stylesheet Git hash and all 116 role page routes remain protected. No additional CSS file, Tailwind upgrade, package change or dependency.
- Backend improvements (if observed and verified) must be logged for review **after Batch 8**, not silently implemented.
- Browser E2E interaction and mobile visual acceptance remain distinct from static build and API regression success.

## CI/acceptance
`node frontend/scripts/check-client-essentials.cjs --built` after Next production build, alongside Batch 0–2 checks, TypeScript, backend/security tests, disposable PostgreSQL, exact-review SHA PR gate, and Production Vercel verification. Check Client Overview, Services and Domains list/detail and Profile at 320, 360, 390, 768, 1024 and 1440 CSS pixels before design signoff.
