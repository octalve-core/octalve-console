"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const view=read("../backend/domains/views.py");
const serializers=read("../backend/domains/serializers.py");
const tests=read("../backend/domains/tests.py");
const api=read("src/lib/api/endpoints.ts");
const routes=read("src/lib/routes.ts");
const nav=read("src/features/shell/components/ClientCatalogNavigation.tsx");
const domain=read("src/features/client/views/ClientDomainManagementView.tsx");
const transfer=read("src/features/client/views/ClientDomainTransferView.tsx");
const register=read("src/app/client/domains/register/page.tsx");
const model=read("src/features/client/utils/domain-contract.ts");
const directory=read("src/components/data/CloudRecordDirectory.tsx");
const list=read("src/features/client/views/ClientResourceListView.tsx");
assert.ok(view.startsWith("# domains/views.py"));
for(const key of [
 "def transfer_readiness(","def renewal_status(","client_id=request.user.pk",
 "metadata__type='domain_renewal'","metadata__domain_id=domain.pk",
 "transfer_eligible': None","checkout_enabled': False",
 "registrar_connected': False","def create_dns_record(",
 "return _requires_approved_provider('Domain renewal')",
 "return _requires_approved_provider('Domain transfer')",
])assert.ok(view.includes(key),"Missing domain backend guard "+key);
assert.ok(!serializers.includes("'nameservers', 'dns_records', 'metadata', 'created_at'"),
 "Domain exposes arbitrary internal metadata");
assert.ok(serializers.includes("'nameservers', 'dns_records', 'created_at'"));
for(const key of [
 "test_customer_exact_domain_details_no_internal_metadata",
 "test_customer_domain_mutations_fail_closed",
 "test_owner_renewal_status_only_for_exact_existing_invoice",
 "test_transfer_preflight_no_epp_persistence_or_availability_claim",
 "test_staff_and_anonymous_cannot_probe_customer_domain"
])assert.ok(tests.includes(key),"Django domain tests "+key);
for(const key of ["domainRenewalStatus(id:string)","domainTransferReadiness(domain:string)",
 "renewal-status/","transfer-readiness/"])assert.ok(api.includes(key));
for(const key of ['domainRegister: "/client/domains/register"',
 'domainTransfer: "/client/domains/transfer"'])assert.ok(routes.includes(key));
for(const key of ["Transfer Domain to Us","Register New Domain",
 "routes.client.domainTransfer","routes.client.domainRegister"])assert.ok(nav.includes(key));
for(const key of ["clientApi.domain(id)","clientApi.domainRenewalStatus(id)",
 "normalizeDomain(details.value)","record.id!==id","CloudRecordDirectory",
 "invoice_ready","Renewal is unavailable"])
assert.ok(domain.includes(key),"Domain detail "+key);
assert.ok(!domain.includes("clientApi.domains()"),"Domain detail must not page-scan");
for(const key of ["clientApi.domainTransferReadiness(domain)",
 "No order or transfer has been started","Do not share your EPP code",
 "transfer_eligible!==null","checkout_enabled!==false"])
assert.ok(transfer.includes(key),"Transfer flow "+key);
assert.ok(!/name=["']epp_code["']/.test(transfer),"Never collect EPP before provider verification");
assert.ok(register.includes("ClientDomainSearch"));
assert.ok(model.includes("normalizeDomain")&&model.includes("DomainDns")&&model.includes("dns_records")&&model.includes("nameservers"));
const core=read("src/components/design-system/record-directory/RecordDirectory.tsx");
const mobile=read("src/components/design-system/record-directory/MobileRecordCard.tsx");
const desktop=read("src/components/design-system/record-directory/DesktopRecordTable.tsx");
assert.ok(directory.includes("<RecordDirectory")&&core.includes("showActions"),"Domain list must use shared action authority");
assert.ok(mobile.includes("onActions?")&&desktop.includes("onActions?"),"Both mobile and desktop need accessible action triggers");
assert.ok(!list.includes("resource===\"domains\"&&<ClientDomainSearch/>"));
for(const loc of [
 "src/app/client/domains/[id]/page.tsx",
 "src/app/client/domains/[id]/dns/page.tsx",
 "src/app/client/domains/[id]/nameservers/page.tsx",
 "src/app/client/domains/[id]/renewal/page.tsx",
 "src/app/client/domains/transfer/page.tsx",
 "src/app/client/domains/register/page.tsx"
])assert.ok(fs.existsSync(path.join(root,loc)),"Missing domain route "+loc);
console.log("PASS: Batch11 domain ownership, registrar failure boundaries, renewal, transfer and mobile/desktop paths");
