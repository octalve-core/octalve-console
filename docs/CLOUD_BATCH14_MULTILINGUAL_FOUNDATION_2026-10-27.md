# Octalve Cloud — Batch 14: Server-Owned Language and Shared-UI Translation Qualification
Date: 27 October 2026
Baseline: Batch 13.2 merged to main at c5044cdaad0b52ed2d3c0a1ac7c4decb002f8256.
Review PR: #47; never claim this pilot is full product localization.

## Implemented on Review
- Reuses the existing accounts.CustomUser.language field; no migration or duplicate locale table.
- Owner-only authenticated GET/PATCH /api/auth/language/, strict payload allowlist and supported code validation. Anonymous access denied; tests exercise all paths.
- BFF /api/cloud/auth/language is explicitly allowlisted for GET/PATCH only, never dynamic route proxying or arbitrary account mutation. Authentication stays in HttpOnly session cookies.
- CLOUD_MULTILINGUAL_ENABLED remains disabled by default. No French choice is available until the feature is explicitly activated after qualification. Existing unknown preference safely renders English without changing records on read.
- One React LocaleProvider follows the authenticated identity, fetches only from the server-owned endpoint, falls back to English on error, rejects unconfirmed account-switch saves, and restores English after logout.
- Type-checked shared en/fr dictionaries cover common Client/Staff/Admin navigation labels, sidebar, header, account menu, search, key customer dashboard summaries and Settings. Dynamic catalogue/product/provider labels are not translated or rewritten. All existing routes retain original paths and ownership constraints.
- Display-only date/currency helpers use Intl with date-only UTC and conservative limits on oversized decimals. Financial authority, paid invoice amounts, locale-independent identifiers and settlement stay in Django.
- Automated Batch 14 CI contract checks BFF method allowlist, locale gate, owner API, dictionary usage, navigation routes, and runtime display formatting.
- Existing Batch 2 and Batch 9 tests were updated to assert retained accessibility and authenticated language source instead of requiring English-only text in the component.

## Required before full Batch 14 acceptance
1. Translate remaining 134+ routes and all visible content, error/validation, notification dynamic messages, support flows and product copy with reviewed dictionaries; detect untranslated keys automatically.
2. Use reviewed server-rendered dictionaries for public SEO/localized routes as applicable. Do NOT insert [locale] into authenticated links until authenticated browser coverage proves role, access, refresh and deep-link parity.
3. Real locale-aware money/date presentation for every relevant record, pluralization and time zone preferences; ensure Django i18n/LocaleMiddleware catalogue integration and owner-scoped Accept-Language only after reviewed locale contract.
4. Arabic requires independent full RTL, keyboard, icon-direction and mixed-script PDF qualification. Arabic is not supported in this pilot.
5. Do not translate legal/tax/invoice/receipt meaning without an approved legally authoritative version and immutable snapshots.
6. Signed-in role-correct browser acceptance on all routes and six viewport widths; CSS retirement remains Batch 15 and cannot use static CI as substitute.

## Release/financial gates
Under the user-approved contingency, green exact-head GitHub CI is acceptable for merging reviewed source when Review API is failing. That alone does not certify live Production. Check actual Console and API Production deployments and authenticated runtime before claiming availability.
REWARDS_API_ENABLED and CLOUD_MULTILINGUAL_ENABLED must remain false unless separate acceptance authorizes activation. No payments, affiliate payouts, provider actions, OPanel authentication changes, schema migrations, Production SQL writes or CSS removal in this batch.

## References
- Next.js App Router internationalization: https://nextjs.org/docs/app/guides/internationalization
- Django translation and request middleware: https://docs.djangoproject.com/en/6.0/topics/i18n/translation/
- Django REST Framework localization: https://www.django-rest-framework.org/topics/internationalization/
- JavaScript Intl monetary/date presentation: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization
