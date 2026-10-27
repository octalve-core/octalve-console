# Octalve Cloud — Batch 10: Customer Services Management
Date: 27 October 2026
Base commit: `4753c3ab831051f3c73d46966cf3c23e7f08ebda`.
Delivery: existing `review/cloud` -> exact-head GitHub CI -> SHA-locked merge to `main`, then both Vercel deployment checks. No new long-lived branches.

## Verified preexisting contracts
- Django `/api/services/services/` lists and retrieves owner-scoped service records. The serializer already exposed `current_usage` using `ServiceUsage` snapshots and `next_due_date`, `auto_renew`, `billing_cycle`, but the Client list did not present usage or plan clearly.
- The old Client detail view searched paginated collection responses to find a service, which could falsely report that an owned record did not exist.
- `/api/services/opanel/{service_id}/overview/` is read only. It delegates verified-provider-proof readiness to `opanel_bridge.policy.eligible`; the independent OPanel authorization flow retains short-lived SSO redemption, service ownership, active status, and valid provider verification gates. Never derive readiness from the frontend.
- `ServiceViewSet.action` denies fictitious server operations. Browser-visible renewals must not create invoices or alter service expiry dates.
- Batch 9 already added Admin-published, dynamic category discovery and the canonical Finance-style desktop/mobile table. Do not create another table or hard-code VPS, SSL, WordPress or future service categories in the UI.

## Changes
1. **Service listing:** same shared `CloudRecordDirectory` with search/status filters, dynamically derived service-type filter, plan name and next due date columns, genuine disk-usage ring in desktop rows and mobile cards. Missing recorded limits produce "Usage unavailable", never fabricated 0% or "100% health".
2. **Exact service detail:** `/client/services/[id]` now requests `GET /api/services/services/{id}/` directly, verifies record ID, and displays owner-approved plan, connected domain, billing cycle, auto-renew flag, status and latest recorded disk/bandwidth usage. No search over the first page of results.
3. **Renewals:** new owner-scoped **GET** `/api/services/services/{id}/renewal-status/` returns `invoice_ready` only for an existing unpaid/partially-paid/overdue renewal invoice belonging to the exact client and service; otherwise `request_assistance` or `unavailable`. No invoice creation, payment capture or due-date adjustment occurs from a GET. Client links to the verified invoice's existing detail or support.
4. **OPanel:** Client detail leads to the existing hosting-readiness page only for hosting service types. Existing server-side provider proof, entitlement and verified provisioning logic remains authoritative. No additional login or client-controlled provider action.
5. **Performance:** plan name is annotated from authoritative catalog records in the queryset, and only the latest per-service usage record is prefetched. Prevent per-item plan lookup and repeated historical usage loads.
6. **Security tests:** new isolated Django tests verify direct detail and usage isolation, cross-tenant 404s, absent/paid renewal invoices, and that read-only renewal requests have no invoice side effects. Frontend source contract guard locks owner/usage/OPanel/renewal boundaries in CI.

## Boundaries for future Batches
- `auto_renew` is displayed as stored but is not a verified automatic supplier settlement; do not promise automated renewal until scheduler, idempotency, invoice settlement and supplier extension are qualified.
- Recorded usage does not imply live infrastructure availability, website reachability, public DNS, SSL or backups. Blank/zero capacity is unavailable, not zero utilization. CPU, traffic and website counts are not invented.
- No new provider adapter, server provisioning, package mutation, DNS edit, OPanel single-use SSO change, price or checkout change in Batch 10.
- OPanel and provider operations require a certified infrastructure adapter + durable worker + provider readback (Phase 4).
- Upcoming Batch 11 handles domain transfer, DNS and registrar activation. Batches 12–14 handle notifications, rewards/affiliates and locale preferences.
- Batch 15 remains responsible for **125 authenticated routes x six viewports = 750** real signed browser qualification cases, including focus/accessibility, loading, error, empty, populated and mobile parity. The legacy stylesheet remains protected pending true browser evidence.

## Deployment checklist
- Verify exact-head TypeScript, Next.js, Batch 0–10 frontend regressions, Django isolated database, security and disposable PostgreSQL CI.
- Confirm no new Django migration files; the consolidated local PowerShell migration runner is NOT needed for this batch.
- Merge only green CI, fast-forward review/cloud to main and verify both Vercel Production checks.
- Post-release smoke in authorized client account: Services table actual rows, recorded usage with positive limit and missing snapshot, service detail direct-link, another client's ID denied, paid vs unpaid renewal invoice; inspect OPanel readiness without attempting unverified provider actions.
- Do not call authenticated production browser parity complete merely because deployments are READY.

Standards: OWASP Authorization Cheat Sheet (per-object checks and deny by default), WAI-ARIA progressbar accessible semantics, Next.js App Router client-side routing, Django REST Framework viewsets.
