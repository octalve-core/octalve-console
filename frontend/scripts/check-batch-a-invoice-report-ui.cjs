"use strict";
// Compatibility gate upgraded when Batch 2 replaced the previous 5-request
// report screen with evidence-backed six-workspace Business Intelligence.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const route=read("src/app/admin/reports/page.tsx");
const wrapper=read("src/features/admin/reports/views/AdminReportsWorkspaceView.tsx");
const view=read("src/features/admin/reports/business-intelligence/BusinessIntelligenceView.tsx");
const panels=read("src/features/admin/reports/business-intelligence/BusinessPanels.tsx");
const contract=read("src/features/admin/reports/business-intelligence/contracts.ts");
const paths=read("src/lib/api/paths.ts");
const client=read("src/lib/api/modules/reports.api.ts");
const reportBackend=read("../backend/reports/business_intelligence.py");
const sheet=read("src/components/design-system/AdaptiveSheet.tsx");
const icon=read("src/components/design-system/ConsoleIconTile.tsx");
const exports=read("src/components/design-system/index.ts");
const pkg=JSON.parse(read("package.json"));
function requireAll(name,body,tokens){
 for(const token of tokens)if(!body.includes(token))throw Error(name+" missing: "+token);
}
requireAll("Report route",route,["AdminReportsWorkspaceView"]);
requireAll("BI wrapper",wrapper,["BusinessIntelligenceView","AdminReportsWorkspaceView"]);
requireAll("BI view",view,["DashboardShell role=\"admin\"","DashboardPage","useAutoSync",
 "privateQueryKey","privateQueryRead","privateQueryWrite","parseBIZSnapshot",
 "reportsApi.businessSnapshot(currency)","OverviewPanel","FinancePanel",
 "CustomersPanel","RenewalsPanel","ProvidersPanel","LibraryPanel",
 "reportsApi.definitions()","reportsApi.instances()","Business Intelligence",
 "section===","currency"]);
requireAll("BI panels",panels,["ConsoleIconTile","ResponsiveTable","font-medium",
 "settlement","Provider","monthLabel","Report definitions","LibraryPanel",
 "supplier","No qualifying"]);
requireAll("Strict decoder",contract,["parseBIZSnapshot","Number.isSafeInteger",
 "settlement_verified!==false","profit_verified!==false","formatMoney",
 "throw Error","currency"]);
requireAll("BI backend",reportBackend,["IsConsoleFinancialAdmin","webhook_verified=True",
 "transaction_type=\"payment\"","Cache-Control","no-store","currency",
 "settlement_verified","profit_verified"]);
requireAll("BI API",paths,["businessSnapshot"]);
requireAll("BI API client",client,["api.get<unknown>(apiPaths.reports.businessSnapshot"]);
requireAll("Native adaptive sheet",sheet,["showModal()","onCancel",
 "aria-labelledby","pb-[env(safe-area-inset-bottom)]","focus({preventScroll:true})"]);
requireAll("Shared icons",icon,["LucideIcon","strokeWidth={1.9}","aria-hidden"]);
requireAll("Design exports",exports,["ConsoleIconTile","AdaptiveSheet"]);
if(!pkg.dependencies["lucide-react"])throw Error("Icons unavailable");
for(const [name,s] of [["view",view],["panels",panels],["adapter",contract]]){
 for(const forbidden of ["previewInvoices","paymentPreview","Math.random(","mockRevenue",
 "localStorage","report.generateDefinition","reportsApi.generateDefinition(",
 "window.open(","download_url","sample ledger"]){
  if(s.includes(forbidden))throw Error(name+" contains unqualified data or action: "+forbidden);
 }
}
if(view.includes("total_revenue")||view.includes("₦"))
 throw Error("Never present mixed currency revenue.");
if(process.argv.includes("--built")){
 const staticRoot=path.join(root,".next/static"),css=[];
 function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,entry.name);
   if(entry.isDirectory())walk(full);else if(full.endsWith(".css"))css.push(full);
  }
 }
 walk(staticRoot);
 if(!css.length)throw Error("Next build emitted no CSS");
}
console.log("PASS: Batch 2 report uses scoped real Django data, six responsive workspaces, strict evidence contract and no public exports.");
