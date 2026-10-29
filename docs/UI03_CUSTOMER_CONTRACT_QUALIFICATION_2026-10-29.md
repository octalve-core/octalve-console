# UI-03 — Customer Contract Qualification (Incremental, Not Release Approval)

Base branch: `feat/ui02-invoice-record-directory-20261029` (UI-02 PR #98).
This is a **stacked draft**, not a replacement for UI-02's acceptance or the full UI-03 release gate.

## Confirmed source issues, corrected in this branch

1. `AdminCustomerListView.get_queryset` previously joined `services` and `invoices` in a combined aggregation. For a user with 2 services and 2 invoices, each invoice can be counted twice. Use a distinct services count and separate correlated `Invoice` sum subqueries for total/unpaid sums, with decimal zero defaults. No ledger rows, invoice states, payment gateways or migrations are modified.
2. `CustomerListSerializer.get_wallet_balance` previously executed `Wallet.objects.filter(user=obj).first()` for every customer. The list queryset now uses `select_related("wallet")`, and the serializer consumes that cached OneToOne relation. Missing wallet continues to show zero.
3. `AdminResourceDetailView` previously looked up customer IDs in the loaded list, so a paginated response could falsely report a customer missing. Customer details now use the Django `GET /api/auth/customers/<id>/` route with the exact URL-encoded ID and a request-sequence guard to reject stale responses. Other resource detail endpoints are not assumed to exist.

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

The targeted module is included explicitly in `.github/workflows/cloud-ci.yml`. Its passing status must be read from the **exact latest commit**, not presumed from PR #98's green workflow.

## Not yet qualified / future UI-03 work

- Exact typed request/response mapping for other customer, order, domain, invoice, support and staff endpoints
- End-to-end server pagination and server-wide search/filter/sort; verify any pagination configuration first
- Stale-request cancellation and principal-scoped data cache/refresh behavior
- Response precision and wallet currency contract; preserve exact money semantics
- Actual latency/query measurements against representative permitted environments
- Genuine authenticated customer screenshots at 320/360/390/768/1024/1440, then 135 × 6 matrix
- Owner visual approval, exact-sha review/merge, Vercel rate-limit clearance, controlled Production deployment and rollback verification

**Release hold:** no merge to main, no Production database changes, no Vercel Production deploy until UI-02 and complete UI-03 release gates pass.
