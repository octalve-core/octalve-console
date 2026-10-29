"use strict";
const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"../src");
const read=x=>fs.readFileSync(path.join(root,x),"utf8");
function has(file,tokens){
 const s=read(file);for(const token of tokens)if(!s.includes(token))throw Error(file+": missing "+token);
 return s;
}
const workbench=has("features/admin/views/CatalogAuthorityWorkbench.tsx",[
 "CatalogSuppliersTab","CatalogProductsPanel","CatalogPlansTab","CatalogPublishTab",
 "CatalogWorkspaceNavigation",'role="tabpanel"',"api.post(`/catalog/offer-drafts/",
 "/providers/providers/","/providers/packages/","parseSupplierCostLines","parsePlanFeatureLines",
 'status:"inactive",is_public:false'
]);
for(const path of ["features/admin/catalog/CatalogSuppliersTab.tsx",
"features/admin/components/CatalogProductsPanel.tsx",
"features/admin/catalog/CatalogPlansTab.tsx",
"features/admin/catalog/CatalogPublishTab.tsx",
"features/admin/catalog/CatalogWorkspaceNavigation.tsx"]){
 const s=read(path);
 for(const bad of ["document.write(","onclick=","from \"@/lib/platform-data\"",".module.css","globals.css"])
  if(s.includes(bad))throw Error("Legacy/mock/unqualified stylesheet in "+path+": "+bad);
}
has("features/admin/catalog/CatalogSuppliersTab.tsx",["Provider connections","packages.filter","pricing?.cycles","onVerify","onSync","onApprove"]);
has("features/admin/components/CatalogProductsPanel.tsx",["onActivate(item.id)","Ready for offers","Save unpublished product"]);
has("features/admin/catalog/CatalogPlansTab.tsx",["Public plan URL slug","Included features","onDefault","onSave","periods"]);
has("features/admin/catalog/CatalogPublishTab.tsx",["drafts.map","onPublish(d.id)",'d.status==="draft"']);
has("features/admin/catalog/CatalogWorkspaceNavigation.tsx",['role="tablist"','aria-selected={selected}',"ArrowRight","ArrowLeft","aria-controls"]);
has("features/client/views/ClientOrderView.tsx",["requestedProduct","requestedRevision","setPlanId(\"\");setCycleKey(\"\")","selectedCycle","chosen?.revision"]);
has("features/client/views/ClientCheckoutView.tsx",["requestedRevision","selected.revision!==Number(requestedRevision)"]);
has("lib/commerce/sanitize-commerce-next.ts",["sanitizeCommerceNext","/client/order","/client/domains/register","if(keys.some"]);
has("features/auth/views/SignupPageClient.tsx",["sanitizeCommerceNext","commerceNext","router.replace"]);
has("features/auth/views/LoginPageClient.tsx",["sanitizeCommerceNext","matchingRoute","/signup?next="]);
has("features/client/components/ClientOverviewActions.tsx",["/client/domains/register"]);
for(const obsolete of ["/client/domains#domain-search","allowed.find(item => item.id === requestedPlan) || allowed[0]"])
 if(workbench.includes(obsolete))throw Error("Disallowed stale route/selection");
const plans=has("features/client/data/client-order-data.ts",["published_revision","product_slug","slug: p.slug ||","Number.isSafeInteger(p.published_revision)"]);
if(!plans.includes('p.status === "active" && p.is_public'))throw Error("Client plan visibility gate missing");
if(process.argv.includes("--built")){
 const files=[],dir=path.resolve(__dirname,"../.next/static");
 function walk(p){if(!fs.existsSync(p))return;for(const e of fs.readdirSync(p,{withFileTypes:true})){
  const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(f.endsWith(".css"))files.push(f);
 }}
 walk(dir);if(!files.length)throw Error("Next CSS build output missing");
 const css=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".border-console-line",".grid",".rounded-xl"])
  if(!css.includes(token))throw Error("Catalog Tailwind class missing from compiled build: "+token);
}
console.log("PASS: unified four-tab admin catalogue uses typed Tailwind, real provider/offer authority, safe purchase intent and domain links");
console.log("PENDING: signed role-authenticated review browser and independent Production release gates.");
