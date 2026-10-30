# UI-03 — Customer Contract Qualification (Incremental, Not Release Approval)

Base branch: `feat/ui02-invoice-record-directory-20261029` (UI-02 PR #98).
This is a **stacked draft**, not a replacement for UI-02's acceptance or the full UI-03 release gate.

## Confirmed source issues, corrected in this branch

1. `AdminCustomerListView.get_queryset` previously joined `services` and `invoices` in a combined aggregation. For a user with 2 services and 2 invoices, each invoice can be counted twice. Use a distinct services count and separate correlated `Invoice` sum subqueries for total/unpaid sums, with decimal zero defaults. No ledger rows, invoice states, payment gateways or migrations are modified.
2. `CustomerListSerializer.get_wallet_balance` previously executed `Wallet.objects.filter(user=obj).first()` for every customer. The list queryset now uses `select_related("wallet")`, and the serializer consumes that cached OneToOne relation. Missing wallet continues to show zero.
3. `AdminResourceDetailView` previously looked up customer IDs in the loaded list, so a paginated response could falsely report a customer missing. Customer details now use the Django `GET /api/auth/customers/<id>/` route with the exact URL-encoded ID and a request-sequence guard to reject stale responses. Other resource detail endpoints are not assumed to exist.
4. **Security release blocker:** DRF `IsAdminUser` authorizes any `is_staff=True` user, including Octalve Staff. The global Admin Customer list/detail were not assignment-scoped and exposed financial data and mutation methods. Both endpoints now require `is_staff`, `is_superuser` and Octalve `role=admin`. Operational Staff can no longer read or change global customer records.
5. The Staff Customers UI formerly called `adminApi.customers()` without assignment scope. That unsafe call is removed. Until a reviewed staff-assignment model and least-privilege serializer are available, the page truthfully reports customer-directory access unavailable and directs staff to their authorized support tickets. Do not invent customer assignments from support tickets.
6. **Customer-detail financial accuracy:** `CustomerDetailSerializer` previously queried Invoice, Order and Service through nonexistent `user` ForeignKeys, imported `Order` from the wrong app and referenced nonexistent list serializers; it swallowed those errors into zero invoice totals and empty recent records. Verified the actual `client` FKs and available `InvoiceSerializer`, `OrderSerializer` and `ServiceSerializer`. Detail now uses the correct model queries and serializer names, real model status choices, and propagates failures rather than fabricating zero balances. Added a real related-record API test for financial totals, overdue state, recent records, wallet and no mutation on GET.


Official guidance reviewed:
- Django ORM multiple annotations: https://docs.djangoproject.com/en/5.2/topics/db/aggregation/
- Aggregate subqueries: https://docs.djangoproject.com/en/5.2/ref/models/expressions/

## Isolated regression evidence added

`backend/accounts/test_customer_directory.py`:
- Two distinct customers with multiple services and invoices, including unpaid amounts
- Empty relation counts/sums
- Serializer wallet query count for multiple customers
- Real DRF anonymous/client denial and authorized Admin filtering/search, no password exposure
- Verified server-side customer detail route, including unauthorized-client denial
- Operational Staff denied global customer list/detail, POST, PATCH and DELETE; no record changes

The targeted module is included explicitly in `.github/workflows/cloud-ci.yml`. Its passing status must be read from the **exact latest commit**, not presumed from PR #98's green workflow.

## Not yet qualified / future UI-03 work

- Establish an actual Staff-assigned customer authority and minimal read serializer; Staff Customers is intentionally unavailable until qualified
- Review remaining Admin endpoints that use DRF `IsAdminUser` for similar role leakage
- Exact typed request/response mapping for other customer, order, domain, invoice, support and staff endpoints
- End-to-end server pagination and server-wide search/filter/sort; verify any pagination configuration first
- Stale-request cancellation and principal-scoped data cache/refresh behavior
- Response precision and wallet currency contract; preserve exact money semantics
- Actual latency/query measurements against representative permitted environments
- Genuine authenticated customer screenshots at 320/360/390/768/1024/1440, then 135 × 6 matrix
- Owner visual approval, exact-sha review/merge, Vercel rate-limit clearance, controlled Production deployment and rollback verification

**Release hold:** no merge to main, no Production database changes, no Vercel Production deploy until UI-02 and complete UI-03 release gates pass.


## Follow-on UI-03 implementation — explicit customer page contract

- `AdminCustomerPagination` caps page size at 50 and defaults to 10. Django now returns `{count,next,previous,results}` for the Admin Customer endpoint while leaving other endpoints' existing responses untouched.
- API accepts Django's authorized `search`/`ordering` plus validated `status`, `date_from` and `date_to`. Invalid status and ISO date pairs return 400; deleted/foreign records are never supplied. Default ordering includes PK tie-break for repeatable pagination.
- `AdminCustomerDirectoryView` uses actual server totals, 300ms debounced requests, server paging, and stale-response isolation. Only the Admin Customers resource opts into the new `ServerDirectoryState`; the existing shared `RecordDirectory` preserves local behavior for other API contract shapes.
- The customer detail and edit screens now both fetch an exact authorized customer ID rather than trusting the first list page; mobile also exposes customer sorting.
- Isolated Django test coverage now includes page boundaries, disjoint results, search across all server records, verified status/date validation, sorting, Admin/Staff role isolation and financial aggregates.

## Explicit release hold (not waived by source-only checks)

- UI-02 six authenticated golden-master screenshots are not present.
- The canonical 135-route × 6-width authenticated visual evidence manifest is not present; the existing source-check fixture explicitly says it is NOT real browser evidence.
- No browser profile is signed into Octalve Console in the available session.
- Vercel's automated preview build attempts report the daily deployment-rate limit; do not create repeated preview builds. Vercel deployment inspection through temporary protected share links was denied; Production verification remains a separate gate.
- GitHub Actions success qualifies tested source only. It is not authorization to label these remaining checks complete.
- No global DRF pagination configuration was changed; order/invoice/domain/service/support directory endpoint contracts require separate source-and-DB qualification.
