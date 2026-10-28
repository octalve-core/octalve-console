"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
function ensure(file,tokens){
 const source=read(file);
 for(const token of tokens)if(!source.includes(token))throw Error(file+": lost Batch 6 contract "+token);
 if(/from\s*["'][^"']+\.css["']/.test(source))throw Error(file+": Staff sections must not import a stylesheet");
}
ensure("features/staff/views/StaffDashboardView.tsx",[
 "Promise.allSettled(keys.map(key=>staffResourceConfig[key].loader()))",
 "result.status!==\"fulfilled\"","countResults(result.value)",
 "unwrapStaffList(result.value).slice(0,3).map(row=>normalizeStaffRecord(row,key))",
 "StaffHero","StaffQuickActions","StaffOverviewMetrics","StaffRecentPanel",
 "counts.tickets===null?\"unavailable\":\"ready\"",
 "counts.provisioning===null?\"unavailable\":\"ready\""
]);
ensure("features/staff/components/StaffOverviewMetrics.tsx",[
 "counts[item.key]","value===null?\"—\":formatNumber(value)",
 "min-h-36","busy={loading}","Panel","WorkspaceGrid","ConsoleIconTile"
]);
ensure("features/staff/components/StaffQuickActions.tsx",[
 "/staff/tickets","/staff/provisioning","/staff/knowledge-base","/staff/orders",
 "Panel","LucideIcon","min-h-32"
]);
ensure("features/staff/components/StaffRecentPanel.tsx",[
 "state===\"loading\"","state===\"unavailable\"","records.slice(0,3)",
 "record.actionHref","StatusBadge"
]);
ensure("features/staff/views/StaffResourceListView.tsx",[
 "config.loader()","unwrapStaffList(response)","normalizeStaffRecord(item, config.key)",
 "setRecords(apiRecords)","setRecords([])","useAutoSync(loadRecords, resource)",
 "StaffOperationalDirectory", "StaffRecordList"
]);
ensure("features/staff/components/StaffOperationalDirectory.tsx",[
 "ResponsiveTable","TextField","SelectField","StatusBadge","getRowKey={r=>r.id}",
 "const PAGE_SIZE=10","setSearch(e.target.value)","setStatus(e.target.value)",
 "resource===\"customers\"","resource===\"orders\"","OperationalResource"
]);
ensure("features/staff/views/StaffSecurityView.tsx",[
 "StaffSecurityOverview",'role="staff"',"DashboardPage"
]);
ensure("features/staff/components/StaffSecurityOverview.tsx",[
 "Access level","Protected actions","Session protected",
 "This page does not expose administrative permission","/staff/tickets"
]);
ensure("features/staff/data/staff-resource-config.ts",[
 "loader: () => adminApi.customers()",
 "loader: () => schemaApi.orders.orders()",
 "loader: () => schemaApi.provisioning.tasks()",
 "loader: () => supportApi.tickets()",
 "loader: () => adminApi.knowledgeBase()"
]);
ensure("features/staff/utils/staff-record-normalizer.ts",[
 "if (!id) throw new Error","encodeURIComponent(id)",
 'customers: "/staff/customers"','provisioning: "/staff/provisioning"'
]);
for(const pathname of [
 "app/staff/page.tsx","app/staff/customers/page.tsx","app/staff/orders/page.tsx",
 "app/staff/provisioning/page.tsx","app/staff/security/page.tsx",
 "app/staff/tickets/page.tsx","app/staff/knowledge-base/page.tsx"
])if(!fs.existsSync(path.join(root,pathname)))throw Error("Staff role route disappeared: "+pathname);
for(const file of [
 "features/staff/components/StaffOverviewMetrics.tsx",
 "features/staff/components/StaffQuickActions.tsx",
 "features/staff/components/StaffRecentPanel.tsx",
 "features/staff/components/StaffOperationalDirectory.tsx",
 "features/staff/components/StaffSecurityOverview.tsx"
]){
 const source=read(file);
 if(/\b(?:adminApi|schemaApi|supportApi|clientApi|helpApi)\b|\bfetch\s*\(/.test(source))
  throw Error(file+": Staff presentational section cannot own backend authority");
 if(/(?<!\w)(?:onProvision|provisionNow|markPaid|grantAdmin)/.test(source))
  throw Error(file+": unverified Staff action must not appear");
}
for(const config of ["tailwind.config.ts"]){
 const body=fs.readFileSync(path.resolve(__dirname,"..",config),"utf8");
 if(!body.includes("./src/features/staff/**/*.{js,ts,jsx,tsx,mdx}"))
  throw Error(config+": Staff components absent from production CSS scan");
}
if(process.argv.includes("--built")){
 const dir=path.resolve(__dirname,"../.next/static"),files=[];
 function scan(folder){
  if(!fs.existsSync(folder))return;
  for(const item of fs.readdirSync(folder,{withFileTypes:true})){
   const p=path.join(folder,item.name);
   if(item.isDirectory())scan(p);else if(item.name.endsWith(".css"))files.push(p);
  }
 }
 scan(dir);if(!files.length)throw Error("No compiled Tailwind CSS emitted");
 const css=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".text-console-ink",".border-console-line",".min-h-32",".min-h-36"])
  if(!css.includes(token))throw Error("Missing Staff Tailwind output "+token);
}
console.log("PASS: Batch 6 Staff overview, customer/order/provisioning directories, security and API authority");
