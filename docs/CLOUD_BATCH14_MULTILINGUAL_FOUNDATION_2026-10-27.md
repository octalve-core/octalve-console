# Octalve Cloud — Batch 14.1 multilingual foundation (Review only)
Date: 27 October 2026. Base: Invoice Template 01 PR #45 merge 1f9ed7ec22523d44eeac35b5cdf4160aed3c032e.

## Scope and actual status
- Reuses `accounts.CustomUser.language`; zero database migrations.
- Adds owner-only `GET/PATCH /api/auth/language/` with strict supported-code allowlist, no arbitrary account/role fields and read-only GET.
- `CLOUD_MULTILINGUAL_ENABLED` defaults OFF in all environments. With the flag off only English can be set or served, including accounts holding legacy unsupported locale strings.
- French pilot provides an actual manually authored translation **only inside the Client Settings language panel**. It is deliberately not described as a translated Console, because other routes, notifications, invoices and legal documents remain English.
- The French pilot is inactive in Production. No UI, status, payment, login or stored profile change is made by this release until a customer explicitly saves a supported preference after operator activation.
- Add isolated Django tests for strict payload, owner isolation, anonymous denial, fallback, gate and persistence. Existing frontend typecheck/build remains the minimum source check.

## Full Batch 14 acceptance still required
1. Route inventory and translated dictionary audit for all 134+ Client/Staff/Admin routes, plus auth/onboarding/support screens; no missing-string leakage or ambiguous automated translation of legal and payment promises.
2. Use Next.js App Router localized routing / server dictionaries or another reviewed SEO-compatible approach; do not mass-rewrite existing links or regress the 804-case browser plan.
3. Localize shared Shell/nav, dynamic server notices, validation/errors, pluralization, dates, timezone and currency formats with Intl and stable monetary decimals. Never localize canonical identifiers, monetary storage, gateway signatures or permission enforcement.
4. Django LocaleMiddleware/Accept-Language with reviewed catalogue; ensure BFF forwards only reviewed locale values, and a saved account locale cannot be silently overridden by a forged tenant hint.
5. Arabic RTL and accessibility reviewed separately (focus order, mixed script, icons, PDF direction) before advertising Arabic support.
6. English legal and invoice/receipt originals remain legally authoritative until each language's fiscal and compliance copy is approved.
7. Enable non-English locale only after full authenticated role/browser parity and operator sign-off; keep default OFF meanwhile.

## Engineering references
- https://nextjs.org/docs/app/guides/internationalization
- https://docs.djangoproject.com/en/6.0/ref/middleware/
- https://www.django-rest-framework.org/topics/internationalization/

## Financial and deployment boundary
This PR does not activate Batch 13 rewards; it does not change payments, invoices, providers, OPanel, production env or migrations. PR #46 remains a separate financial-review gate. Build on an independent main-based branch and merge only after isolated CI and exact-commit Review qualification. Both Production deployments must be checked by SHA before calling a release complete.
