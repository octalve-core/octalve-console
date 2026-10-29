"use strict";
const fs=require("node:fs"),path=require("node:path");
const front=path.resolve(__dirname,".."),root=path.join(front,"src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function must(p,parts){
 const c=read(p);
 for(const token of parts)if(!c.includes(token))throw Error(p+" missing "+token);
 return c;
}
const css=must("components/design-system/WorkspaceGrid.module.css",[
 ".commerceColumns",".supportColumns",".domainFacts",".domainPanels",
 ".choiceColumns",".planCards",".editorFields",
 "@media (min-width: 640px)","@media (min-width: 768px)",
 "@media (min-width: 1024px)","@media (min-width: 1280px)","@media (min-width: 1536px)"
]);
if(css.includes(":global("))throw Error("Client commerce layouts must remain scoped to one CSS module");
const grid=must("components/design-system/WorkspaceGrid.tsx",[
 "as?:","commerceColumns","supportColumns","domainFacts","domainPanels",
 "choiceColumns","planCards","editorFields",
 'if(as==="dl")return <dl','if(as==="section")return <section'
]);
for(const word of ["fetch(","axios(","localStorage","sessionStorage","authApi.","clientApi.","schemaApi."]){
 if(grid.includes(word))throw Error("Grid primitive must not acquire domain API or session authority: "+word);
}
const cases=[
 ["features/client/views/ClientOrderView.tsx",[
  'WorkspaceGrid variant="commerceColumns"',"loadSellablePlans()","defaultCycle(chosen)",
  "categorySlug","setPlanId","onSelect={selectPlan}","HostingOrderSummary"
 ]],
 ["features/client/views/ClientCheckoutView.tsx",[
  'WorkspaceGrid variant="commerceColumns"','WorkspaceGrid variant="choiceColumns"',
  "authApi","clientApi","placeOrder","setDomainChoice(key)","setQuote(null)",
  "agreed","CheckoutQuoteSummary","stage!==\"completed\"","stage===\"completed\""
 ]],
 ["features/client/views/ClientDomainManagementView.tsx",[
  'WorkspaceGrid variant="domainFacts" as="dl"','WorkspaceGrid variant="domainPanels"',
  "normalizeDomain","DomainRenewalStatus","mode===\"renewal\"","mode===\"dns\"",
  "mode===\"overview\"","Manage DNS records"
 ]],
 ["features/client/views/ClientSupportTicketEditorView.tsx",[
  'WorkspaceGrid variant="supportColumns"',"<SupportRequestFields",
  "onSubmit={submit}","clientApi","helpApi","router.push",
  'role="client"'
 ]],
 ["features/client/components/commerce/HostingPlanCards.tsx",[
  'WorkspaceGrid variant="planCards" as="section" ariaLabel="Available published hosting plans"',
  "defaultCycle(plan)","formatPlanAmount(pricing.price,plan.currency)",
  "aria-pressed={selected}","onClick={()=>onSelect(plan)}","plan.features"
 ]],
 ["features/admin/components/AdminEditorFields.tsx",[
  'WorkspaceGrid variant="editorFields"',"TextField","SelectField","TextAreaField",
  "onChange(field.name,event.target.value)","fieldErrors[field.name]"
 ]]
];
for(const [path,parts] of cases){
 const body=must(path,parts);
 if(body.includes('className="grid ')||body.includes('className="mt-6 grid '))
  throw Error("Migrated feature retained collision-prone unlayered .grid: "+path);
}
const state=JSON.parse(fs.readFileSync(path.join(front,"audits/console-ui-baseline-2026-10-26.json"),"utf8"));
if(state.legacyCss.lines!==8460||state.legacyCss.gitBlobSha!=="af02677f8f5b1b06afd93be7f852a2071ce77f85")
 throw Error("CSS compatibility fingerprint unexpectedly changed");
if(process.argv.includes("--built")){
 const files=[];
 function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith(".css"))files.push(p);
 }}
 walk(path.join(front,".next/static"));if(!files.length)throw Error("No compiled stylesheets");
 const out=files.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const token of ["commerceColumns","domainFacts","choiceColumns","planCards","editorFields"])
  if(!out.includes(token))throw Error("Scoped CSS did not compile: "+token);
}
console.log("PASS: real hosting/checkout/domain/support/Admin editors use scoped grids, with route and business authority preserved.");
console.log("PENDING: six viewport signed browser acceptance and final zero-consumer global CSS retirement.");
