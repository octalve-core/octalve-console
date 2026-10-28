"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const policy=read("features/admin/data/admin-action-policy.ts");
const config=read("features/admin/data/admin-resource-config.ts");
const list=read("features/admin/views/AdminResourceListView.tsx");
const editor=read("features/admin/views/AdminResourceEditorView.tsx");
const details=read("features/admin/views/AdminResourceDetailView.tsx");
const restricted=read("features/admin/views/AdminRestrictedActionView.tsx");
for(const key of ["orders","invoices","domains","gateways","provisioning"]){
 assert.match(policy,new RegExp("\\b"+key+": \\{"),"Missing authority guard: "+key);
 const block=config.slice(config.indexOf("  "+key+": {"),config.indexOf("  "+key+": {")+900);
 assert.ok(block&&!block.includes("createHref:"),"Unsafe Create button returned: "+key);
}
for(const token of [
 "if(isAdminMutationDisabled(props.resource))return <AdminRestrictedActionView resource={props.resource}/>",
 "saveAdminResourceRecord(resource, effectiveMode, payload",
])assert.ok(editor.includes(token),"Direct legacy Admin editor route guard missing: "+token);
assert.ok(details.includes('resource==="providers"?[]:isAdminMutationDisabled(resource)?[]'),
 "Detail screen still advertises unqualified Edit");
assert.ok(list.includes("<AdminResourceAuthorityGuide resource={resource}/>"),
 "Admin list must explain available authority");
assert.ok(restricted.includes("No changes have been submitted.")&&!restricted.includes("<form"),
 "Unavailable operations must not pretend a Save exists");
const settings=read("features/admin/components/AdminSettingsSectionPanel.tsx");
const studio=read("features/admin/invoice-studio/AdminInvoiceTemplateStudio.tsx");
assert.ok(settings.includes('href:"/admin/invoice-designer"'),"Settings invoices need working template link");
assert.ok(list.includes("AdminResourceAuthorityGuide"),"Invoice workspace lacks designer link");
assert.ok(studio.includes('href="/admin/billing/invoices"')&&studio.includes('href="/admin/settings/invoices"'),
 "Invoice studio must return to invoice records and policy");
const integration=read("features/admin/integrations/IntegrationStore.tsx");
const card=read("features/admin/integrations/ProviderCard.tsx");
const side=read("features/admin/integrations/ProviderSideSheet.tsx");
assert.ok(integration.includes("Retry connection status")&&integration.includes("connectionOverview.retry"),
 "An unavailable provider registry must expose a safe retry");
assert.ok(card.includes("Status unavailable")&&card.includes("Checking status"),
 "Unavailable registry must not be displayed as disconnected");
assert.ok(side.includes("This does not mean a provider is disconnected."),
 "Provider side sheet must distinguish unknown from disconnected");
for(const source of [integration,card,side]){
 assert.ok(!/api\.post|api\.patch|api\.put|type="password"|localStorage|sessionStorage/.test(source),
 "Integration UI may not activate or store supplier secrets");
}
const client=read("features/client/views/ClientServiceDetailView.tsx");
const confirm=read("features/client/components/ServiceCancellationRequest.tsx");
const api=read("lib/api/endpoints.ts");
assert.ok(client.includes("<ServiceCancellationRequest serviceId={id} serviceStatus={data.status}/>"),
 "Service review cannot be disconnected from the owner-scoped detail");
for(const token of ["Request a review","Confirm review request","Keep my service","provider_action_taken!==false"]){
 assert.ok(confirm.includes(token),"Cancellation confirmation contract missing "+token);
}
assert.ok(api.includes('byId(apiPaths.client.services,id)+"request-cancellation/"'),
 "Cancellation review must use owner-scoped Django endpoint");
assert.ok(!confirm.includes("serviceAction(")&&!confirm.includes("terminate"),
 "Review control must not execute host termination");
console.log("PASS: Batch C safe action routing, invoice discoverability, integration readback, and service review.");
