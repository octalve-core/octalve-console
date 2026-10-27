"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
function read(filename){return fs.readFileSync(path.join(root,filename),"utf8");}
function requireParts(filename,parts){
 const body=read(filename);
 for(const item of parts)if(!body.includes(item))throw Error(filename+": required Batch 7 contract missing: "+item);
}
requireParts("features/admin/views/AdminOverviewView.tsx",[
 "Promise.allSettled([","adminApi.customers()","schemaApi.billing.invoices()",
 "schemaApi.payments.transactions()","AdminOverviewMetrics","AdminQuickActions"
]);
requireParts("features/admin/components/AdminOverviewMetrics.tsx",[
 "counts[item.key]","value===null","Panel"]);
requireParts("features/admin/views/AdminResourceListView.tsx",[
 "config.loader()","normalizeRecord(item, config.key)","AdminResourceDirectory"]);
requireParts("features/admin/components/AdminResourceDirectory.tsx",[
 "ResponsiveTable","StatusBadge","SelectField","TextField","PAGE_SIZE=10"]);
requireParts("features/admin/views/AdminResourceDetailView.tsx",[
 "listConfig.loader()","normalizeAdminRecord(item, listConfig.key)",
 "setRecord(foundApiRecord ?? null)","AdminRecordDetailPanel"]);
requireParts("features/admin/utils/read-authorized-detail.ts",[
 "rows.find","if(!row)return null","actionHref:href"]);
requireParts("features/admin/workspace/views/AdminWorkspaceView.tsx",[
 "config.loader()","setRecords(apiRecords)","AdminGenericDirectory"]);
requireParts("features/admin/operations/views/AdminOperationListView.tsx",[
 "config.loader()","setRecords(apiRecords)","AdminGenericDirectory"]);
requireParts("features/admin/workspace/views/AdminWorkspaceDetailView.tsx",[
 "config.loader()","readAuthorizedDetail","!record?<ErrorState"]);
requireParts("features/admin/operations/views/AdminOperationDetailView.tsx",[
 "config.loader()","readAuthorizedDetail","!record?<ErrorState"]);
requireParts("features/admin/components/AdminGenericDirectory.tsx",[
 "ResponsiveTable","PAGE_SIZE=10","allowDetails"]);
requireParts("features/admin/views/AdminResourceEditorView.tsx",[
 "AdminEditorFields","saveAdminResourceRecord","parseApiValidationError",
 "setFieldErrors(parsedError.fieldErrors)","buildPayload(submittedValues)"]);
requireParts("features/admin/components/AdminEditorFields.tsx",[
 "TextField","TextAreaField","SelectField","error"]);
requireParts("features/admin/settings/views/AdminSettingsHubView.tsx",[
 "AdminSettingsDirectory","adminSettingsItems"]);
requireParts("features/admin/settings/views/AdminSettingsSectionView.tsx",[
 "AdminSettingsSectionPanel","getAdminSettingsItem"]);
requireParts("features/admin/components/AdminSettingsSectionPanel.tsx",[
 "not verified or saved settings values","/admin/servers"]);
requireParts("features/admin/views/CatalogAuthorityWorkbench.tsx",[
 "AdminCatalogIntro","api.get(\"/catalog/offer-drafts/\")",
 "async function saveDraft()","async function approveSupplierPackage()",
 "publish/"]);
for(const file of [
 "AdminOverviewMetrics.tsx","AdminQuickActions.tsx","AdminResourceDirectory.tsx",
 "AdminRecordDetailPanel.tsx","AdminGenericDirectory.tsx","AdminSettingsDirectory.tsx",
 "AdminSettingsSectionPanel.tsx","AdminEditorFields.tsx","AdminCatalogIntro.tsx"
]){
 const p="features/admin/components/"+file,body=read(p);
 if(/from\s*["'][^"']+\.css["']|\b(?:adminApi|schemaApi|clientApi)\b|\bfetch\s*\(/.test(body))
  throw Error(p+": presentational component cannot own API or stylesheet");
}
for(const name of ["tailwind.config.ts"]){
 const value=fs.readFileSync(path.resolve(__dirname,"..",name),"utf8");
 if(!value.includes("./src/features/admin/**/*.{js,ts,jsx,tsx,mdx}"))
  throw Error("Admin Tailwind feature glob missing: "+name);
}
function countPages(dir){
 if(!fs.existsSync(dir))return 0;
 return fs.readdirSync(dir,{withFileTypes:true}).reduce((total,item)=>{
  const p=path.join(dir,item.name);
  return total+(item.isDirectory()?countPages(p):item.name==="page.tsx"?1:0);
 },0);
}
if(countPages(path.join(root,"app/admin"))!==84)throw Error("Admin 84-route audit drift");
if(process.argv.includes("--built")){
 const css=[],folder=path.resolve(__dirname,"../.next/static");
 function scan(dir){if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,entry.name);
   if(entry.isDirectory())scan(p);else if(p.endsWith(".css"))css.push(p);
  }}
 scan(folder);if(!css.length)throw Error("Next generated CSS not found");
 const compiled=css.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".text-console-ink",".border-console-line",".min-h-48"])
  if(!compiled.includes(token))throw Error("Tailwind token missing: "+token);
}
console.log("PASS: Batch 7 Admin source and compiled Tailwind, 84 routes and backend authority");
