"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
function ensure(file,checks){
 const text=read(file);
 for(const needle of checks)if(!text.includes(needle))throw Error(file+": lost required contract "+needle);
 if(/(?:from\s*["'][^"']+\.css["']|className="oct-)/.test(text))throw Error(file+": must not introduce CSS modules/legacy class styles");
}
ensure("features/client/views/ClientDashboardView.tsx",[
 "useClientSummary()","ClientOverviewActions","ClientOverviewMetrics","ClientOverviewRecent","summary.serviceRecordsAvailable","summary.invoiceRecordsAvailable"
]);
ensure("features/client/components/ClientOverviewMetrics.tsx",[
 "summary.services","summary.invoices","summary.domains","summary.wallet","summary.tickets","summary.wallet===null","Panel"
]);
ensure("features/client/views/ClientResourceListView.tsx",[
 "config.loader()","unwrapClientList(response)","normalizeClientRecord(item, config.key)",
 "setRecords([])","ClientEssentialRecords","resource===\"services\"||resource===\"domains\"","ClientDomainSearch"
]);
ensure("features/client/components/ClientEssentialRecords.tsx",[
 "CloudRecordDirectory","onOpen={openDetails}","verified.actionHref","records.map(record=>",
 "rows={rows}","columns={[","resource===\"domains\""
]);
ensure("features/client/views/ClientResourceDetailView.tsx",[
 "config.loader()","setRecord(foundApiRecord ?? null)","if (!foundApiRecord)","ClientEssentialDetail"
]);
ensure("features/client/components/ClientEssentialDetail.tsx",[
 "record.meta","record.status","record.date","record.amount","actions.map","No synthetic payment"
]);
ensure("features/client/views/ClientProfileView.tsx",[
 "authApi.profile()","authApi.saveProfile(draft)","authApi.changePassword(password.current,password.next)",
 "authApi.requestEmailVerification()","await refreshUser()","ClientProfileDetailsForm","ClientProfileSecurity"
]);
ensure("features/client/components/ClientProfileDetailsForm.tsx",[
 "EditableAccountProfile","TextField","ActionButton","onSubmit={onSubmit}","onChange(field.key,event.target.value)"
]);
ensure("features/client/components/ClientProfileSecurity.tsx",[
 "TextField","ActionButton","onPasswordSubmit","onVerify","emailVerified"
]);
ensure("features/client/components/ClientDomainSearch.tsx",[
 "credentials:\"omit\"","cache:\"no-store\"","next.signal.aborted","setResult(data)","Panel","SectionHeading"
]);
ensure("features/client/components/domain-search/DomainSearchResult.tsx",[
 "value.registrar_connected&&value.availability===\"available\"",
 "Availability not yet verified","StatusBadge","No registration or payment has been started"
]);
ensure("features/client/components/domain-search/DomainSearchForm.tsx",[
 'htmlFor="client-domain-search"','className="grid min-w-0 gap-3 sm:grid-cols-3',
 'className="flex h-14 min-h-14 w-full min-w-0 items-center sm:col-span-2'
]);
const initial=read("features/client/hooks/useClientSummary.ts");
if(!initial.includes("Promise.allSettled")||!initial.includes("walletBalance")||
 !initial.includes('status:"loading"')||!initial.includes('status:"ready"')){
 throw Error("Real client summary loading/partial-state authority must not be weakened");
}
const config=read("features/client/data/client-resource-config.ts");
for(const expression of ["loader: () => clientApi.services()","loader: () => clientApi.domains()"])
 if(!config.includes(expression))throw Error("Client Services/Domains loaders changed");
if(process.argv.includes("--built")){
 const dir=path.resolve(__dirname,"../.next/static"),css=[];
 function scan(folder){if(!fs.existsSync(folder))return;
  for(const item of fs.readdirSync(folder,{withFileTypes:true})){
   const name=path.join(folder,item.name);if(item.isDirectory())scan(name);else if(name.endsWith(".css"))css.push(name);
  }}
 scan(dir);if(!css.length)throw Error("No compiled Tailwind assets for Batch 3");
 const output=css.map(file=>fs.readFileSync(file,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".text-console-ink",".border-console-line",".min-h-36"])
  if(!output.includes(token))throw Error("Batch 3 utility missing from compiled CSS "+token);
}
console.log("PASS: Batch 3 Client Overview, Services, Domains, Profile and genuine API authority contracts");
