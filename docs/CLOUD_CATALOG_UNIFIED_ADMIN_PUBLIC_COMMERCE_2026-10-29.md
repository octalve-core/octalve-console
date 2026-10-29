# Octalve Cloud — Catalogue UI/commerce contract (CATALOG-01–05)
Review baseline: Console `558f4bde20c75aab17a1b037916c33fa87ff91d2`; Public Cloud `e2984077ad6570656304f1086e585655bb64211d`. User-supplied four-tab HTML was a **visual reference**, not an authority or a working UI.

## Single authority and source ownership
- Django `catalog.Product/Plan/PlanBillingCycle/PlanFeature` and `PublishedCatalogOffer` remain the only customer-facing pricing publication source. All writes use current `/catalog/*`, `/providers/*` authenticated BFF with existing Admin RBAC and supplier proof, not frontend local JSON, direct generic plan CRUD or unsafe fake data.
- `frontend/src/features/admin/views/CatalogAuthorityWorkbench.tsx` owns real refresh, mutations, state and form handlers. Presentation is split into `catalog/CatalogSuppliersTab`, upgraded `components/CatalogProductsPanel`, `catalog/CatalogPlansTab`, `catalog/CatalogPublishTab`, `catalog/CatalogWorkspaceNavigation`. Shared DashboardShell, DashboardPage, Panel, StatusBadge, Tailwind tokens and Lucide icons are reused.
- Four keyboard-addressable tabs at existing `/admin/catalog/workbench#suppliers|products|plans|publish`; preserve state while switching. No new global CSS, no duplicate Tailwind config. Older `globals.css` still has other dependencies; final retirement requires separate zero-consumer and 810 authenticated browser evidence.

## Supplier, product and versioned plan
- Inventory counts reflect fetched records; a supplier connection with unverified health is **not operational**. Protected supplier credentials never reach public API.
- Supplier wholesale rows parse actual CRLF/LF Enter, validate exactly one of six known billing keys, exact two-decimal positive values and forbid duplicates. Partner supplier costs and technical resources are still checked by trusted Django publication/checkout authority.
- Products start `inactive,is_public=false`, never imply immediate public publication. A deliberate Admin `PATCH /catalog/products/{id}/` readiness action marks the product `active,is_public=true` for offer review; customers still cannot purchase without `PublishedCatalogOffer`.
- Product URL slug uniqueness validated by Django; once a product has any published plan its URL slug cannot change in normal editor. Plan slug is stable across revisions and unique within a product; the draft serializer validates it.
- Plan marketing summary is distinct from included features. Enter-separated lines produce `PlanFeature(label,value,is_highlighted)`; `Storage: 10 GB` maps to a bounded technical claim while `Priority support` maps to a blank-value marketing bullet. Server verifies technical claims at publication. Six approved terms are the only available recurring periods; invalid amounts and duplicate keys are rejected.
- Admin publication stays immutable, transactional, versioned and server-validated; no publishing from a mere visual readiness score. No auto payment/provisioning/registrar action.

## Public → authentication → exactly selected purchase
- `octalve-cloud` published cards consume read-only `/api/storefront/plans/` with `product_slug`, `slug`, and `published_revision`; selection URL includes only product/plan slugs, billing cycle and revision, never price or private supplier info.
- Console `/client/order?product=shared-web-hosting&plan=octalve-business&cycle=12mo&revision=3` resolves the exact eligible plan and cycle. A missing, mismatched, unavailable or superseded selection is reported; **no substitution with the first visible plan**. Older exact numeric Console plan IDs are still accepted for legacy links.
- Console middleware `/login?next=...` retains the approved internal purchase or domain destination for unauthenticated users. Login and signup restore the same validated Client target; already authenticated Clients follow the intent. Non-commerce deep links are not discarded for their authenticated role. Never accept absolute, protocol-relative, cross-role or attacker-controlled external URLs.
- Checkout still requests a server-controlled quote and sends the exact numeric plan ID/current published revision; the backend independently verifies supplier health, cycle, currency, snapshot and total. A changed revision requires customer reconfirmation.
- Public domain search and suggestion CTAs now point to `/client/domains/register?domain=...`; `/client/domains` remains My Domains. No registrar is connected: availability, registration, transfer and payment remain unverified/disabled.

## Tests and release holds
- Node negative tests validate multiline supplier/feature input, duplicate rates, invalid redirects, malformed slugs, revision values and URL supply.
- Django regression tests cover duplicate Plan/Product slugs, immutable published slugs, structured features, no private supplier exposure, stale offers, invalid provider resources and reseller costs. Existing PostgreSQL isolation suite, Next TypeScript/build, frontend source/emitted Tailwind, security CI must all pass at exact PR heads before merge.
- Independent Review user signed browser evidence (Admin, Staff, Client), **135 routes × 6 viewports = 810 cases** is still pending; do not pretend GitHub green CI is equivalent. The current live public storefront returned zero published plans/categories and no registrar rates during this review. Do not seed or create fake Production products.
- Supplier credential enablement requires separately approved MFA/WebAuthn, externally owned KMS/egress and real supplier certification; no change here.
- Vercel exact SHA Production deploy/alias requires current authorized team permissions (previously 403) and quota. No Production database migrations, payments, registrar changes, vendor credentials or provisioning are performed.

## Documentation references
- https://owasp.org/www-community/attacks/Unvalidated_Redirects_and_Forwards
- https://www.django-rest-framework.org/api-guide/validators/
- https://nextjs.org/docs/app/getting-started/css
