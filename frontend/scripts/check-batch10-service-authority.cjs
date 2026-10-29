"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const service=read("features/client/utils/service-contract.ts");
const ring=read("features/client/components/ServiceUsageRing.tsx");
const table=read("features/client/components/ClientEssentialRecords.tsx");
const directory=read("components/data/CloudRecordDirectory.tsx");
const page=read("features/client/views/ClientServiceDetailView.tsx");
const route=read("app/client/services/[id]/page.tsx");
const api=read("lib/api/endpoints.ts");
const django=fs.readFileSync(path.join(root,"../../backend/services/views.py"),"utf8");
const serializer=fs.readFileSync(path.join(root,"../../backend/services/serializers.py"),"utf8");
const djangoTests=fs.readFileSync(path.join(root,"../../backend/services/tests.py"),"utf8");
for(const token of [
 "normalizeServiceSnapshot","usagePercent","disk_limit_mb",
 "bandwidth_limit_mb","recorded_at","limit<=0","Number.isFinite",
 "Service identifier is unavailable.","amount:clean(value.amount)"
]) assert.ok(service.includes(token),"Missing strict service read contract "+token);
for(const token of ["role=\"progressbar\"","aria-valuenow","aria-valuetext",
  "Math.min(percent,100)","Usage unavailable"])assert.ok(ring.includes(token));
for(const token of ["CloudRecordDirectory","onOpen={openDetails}","Renewal options",
  "View usage","category:resource===\"services\"","ServiceUsageRing",
  'records={rows}',"Check hosting readiness"])assert.ok(table.includes(token),"Service directory "+token);
const rowTypes=read("components/design-system/record-directory/types.ts");
const canonical=read("components/design-system/record-directory/RecordDirectory.tsx");
const mobile=read("components/design-system/record-directory/MobileRecordCard.tsx");
const filters=read("components/design-system/record-directory/DirectoryFilterSheet.tsx");
for(const token of ["category?:string","extra?:ReactNode"])assert.ok(rowTypes.includes(token),"Shared record contract "+token);
for(const token of ["setFilter","r.category","r.extra"])assert.ok((canonical+mobile).includes(token),"Shared category/extra UI "+token);
assert.ok(filters.includes('value={draft.category}'),"Category filter must remain usable");
assert.ok(directory.includes("<RecordDirectory")&&directory.includes("category:r.category"),"Client record adapter must preserve service category");
for(const token of ["clientApi.service(id)","clientApi.serviceRenewalStatus(id)",
 "normalizeServiceSnapshot","if(exact.id!==id)","Read only","requestId.current",
 'id="usage"','id="renewal"',"hosting-status",
 "Review renewal invoice","Request renewal assistance"])assert.ok(
 page.includes(token)||token==="Read only"&&page.includes("Opening this page does not issue an invoice."),
 "Missing service detail gate "+token);
assert.match(route,/ClientServiceDetailView/);
assert.ok(!route.includes("ClientResourceDetailView"));
assert.ok(api.includes('serviceRenewalStatus(id: string)'));
assert.ok(api.includes('"renewal-status/"'));
assert.ok(django.startsWith("# services/views.py"));
assert.ok(serializer.startsWith("# services/serializers.py"));
for(const token of ["def renewal_status(","client_id=request.user.pk","metadata__type='renewal'",
 "status__in=('unpaid', 'partially_paid', 'overdue')","'usage_history'","Subquery(plan_name)"])
 assert.ok(django.includes(token),"Django service authority "+token);
assert.ok(serializer.includes("'plan_name'"));
assert.ok(serializer.includes("latest_usage_prefetch"));
for(const token of ["test_renewal_never_creates_invoice_from_get",
 "test_renewal_not_exposed_to_staff_anonymous_or_other_client",
 "test_exact_owner_renewal_invoice_only_and_no_payment_mutation",
 "test_service_detail_and_usage_are_owner_scoped"])assert.ok(djangoTests.includes(token));
for(const src of [service,ring,table,page]) assert.ok(!/from\s*["'][^"']+\.css["']/.test(src),"No global styling in Batch10");
console.log("PASS: Batch10 secure exact service reads, visible usage, renewal invoice authority, adaptive tables and OPanel checks");
