"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const route=read("src/app/admin/reports/page.tsx");
const view=read("src/features/admin/reports/views/AdminReportsWorkspaceView.tsx");
const adapter=read("src/features/admin/reports/lib/report-presentation.ts");
const module=read("src/features/admin/reports/views/AdminReportsWorkspace.module.css");
const sheet=read("src/components/design-system/AdaptiveSheet.tsx");
const sheetCSS=read("src/components/design-system/AdaptiveSheet.module.css");
const icon=read("src/components/design-system/ConsoleIconTile.tsx");
const exports=read("src/components/design-system/index.ts");
const pkg=JSON.parse(read("package.json"));
function requireAll(name,body,tokens){
 for(const token of tokens)if(!body.includes(token))throw Error(name+" missing: "+token);
}
requireAll("Report route",route,["AdminReportsWorkspaceView"]);
if(route.includes("AdminOperationListView"))throw Error("Report still routed to generic table");
requireAll("Report view",view,[
 "DashboardShell role=\"admin\"","DashboardPage","ActionButton","StatusBadge","AdaptiveSheet","ConsoleIconTile",
 "reportsApi.definitions()","reportsApi.instances()","reportsApi.revenueByGateway()",
 "reportsApi.revenueByProduct()","reportsApi.revenueSummary({period:\"day\"})",
 "Promise.allSettled(","useAutoSync","CountsBreakdown","ReportLibrary","ReportHistory",
 "style={{width:","role=\"status\"","AdminReportsWorkspace.module.css"
]);
requireAll("Report adapter",adapter,["parsePaidInvoiceCount","parseGatewayCounts","parseProductCounts",
 "parseDefinitions","parseInstances","Number.isSafeInteger","throw new Error"]);
for(const forbidden of ["previewInvoices","paymentPreview","Math.random(","sample ledger","mockRevenue","localStorage",
 "report.generateDefinition","reportsApi.generateDefinition(","revenueByGateway = 0"]) {
 if(view.includes(forbidden))throw Error("Unqualified financial display or mutation found: "+forbidden);
}
if(view.includes("total_revenue")||view.includes("currency:\"NGN\"")||view.includes("₦"))
 throw Error("Mixed-currency financial aggregate must not be presented as NGN");
requireAll("Scoped report CSS",module,[".metrics",".breakdowns",".library",".history"]);
if(view.includes('className="grid '))throw Error("Report must not depend on conflicting global .grid");
requireAll("Native adaptive sheet",sheet,["showModal()","onCancel","aria-labelledby","AdaptiveSheet.module.css"]);
requireAll("Mobile bottom sheet",sheetCSS,["@media (max-width: 639px)","safe-area-inset-bottom",".sheet::backdrop"]);
requireAll("Shared icon tile",icon,["LucideIcon","strokeWidth={1.9}","aria-hidden"]);
requireAll("Design system exports",exports,["ConsoleIconTile","AdaptiveSheet"]);
if(!pkg.dependencies["lucide-react"])throw Error("Existing shared icon library not available");
if(process.argv.includes("--built")){
 const staticRoot=path.join(root,".next/static"),css=[];
 function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,entry.name);
   if(entry.isDirectory())walk(full);
   else if(full.endsWith(".css"))css.push(full);
  }
 }
 walk(staticRoot);
 if(!css.length)throw Error("Next build did not emit CSS");
 const built=css.map(file=>fs.readFileSync(file,"utf8")).join("\n");
 for(const token of ["AdminReportsWorkspace_metrics","AdminReportsWorkspace_breakdowns","AdaptiveSheet_sheet"])
  if(!built.includes(token))throw Error("Scoped component CSS missing in output: "+token);
}
console.log("PASS: Batch A report UI uses real read-only Django sources, scoped responsive CSS, Lucide icons, and accessible adaptive sheet.");
console.log("PENDING: authenticated viewport browser evidence and backend currency-qualified financial totals.");
