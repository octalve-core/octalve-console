"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function has(file,tokens){
 const body=read("src/"+file);
 for(const token of tokens)if(!body.includes(token))throw Error(file+" missing "+token);
 return body;
}
const grid=has("components/design-system/WorkspaceGrid.tsx",["clientMetrics","quickActions","styles[variant]"]);
const gridCSS=has("components/design-system/WorkspaceGrid.module.css",[".clientMetrics",".quickActions","--console-client-shortcut-columns","@media (min-width: 640px)"]);
const metrics=has("features/client/components/ClientOverviewMetrics.tsx",[
 "WorkspaceGrid","ConsoleIconTile","summary.services","summary.invoices","summary.domains","summary.wallet","summary.tickets",
 "summary.status","summary.wallet===null","formatCurrency","translateNavigationLabel","variant=\"clientMetrics\""
]);
const actions=has("features/client/components/ClientOverviewActions.tsx",[
 "WorkspaceGrid","ConsoleIconTile","variant=\"quickActions\"","/client/order","/client/domains#domain-search","/client/support/new","/client/invoices",
 "translateNavigationLabel"
]);
const billing=has("features/client/components/commerce/BillingRecordDirectory.tsx",[
 "WorkspaceGrid variant=\"filters\"","ResponsiveTable","StatusBadge","ActionLink",
 "TextField","SelectField","getRowKey={r=>r.id}","setSearch(e.target.value)","setStatus(e.target.value)"
]);
const profile=has("features/client/components/ClientProfileDetailsForm.tsx",[
 "WorkspaceGrid variant=\"filters\"","ConsoleIconTile","onSubmit={onSubmit}",
 "disabled={saving}","onChange(field.key,event.target.value)","ActionButton"
]);
const auth=has("features/auth/components/AuthLayout.tsx",[
 'AuthLayout.module.css',"styles.frame","AuthBrandPanel","AuthBrandLogo","/privacy-policy","/terms-of-service"
]);
const authCss=has("features/auth/components/AuthLayout.module.css",[
 ".frame","--console-auth-panel-columns","@media (min-width: 1024px)"
]);
if(auth.includes('className="grid ')||metrics.includes('className="grid ')||actions.includes('className="grid ')||
 billing.includes('className="grid ')||profile.includes('className="grid '))
 throw Error("Migrated Client/auth surface still depends on global .grid");
const bad=["fetch(", "axios(", "window.localStorage","markPaid(", "provision(", "authorizeOpanel("];
for(const s of bad){
 if((grid+auth+gridCSS+authCss+metrics+actions+billing+profile).includes(s))
  throw Error("Presentation-only migration accidentally acquired business/session authority: "+s);
}
const baseline=JSON.parse(read("audits/console-ui-baseline-2026-10-26.json"));
if(baseline.legacyCss.lines!==8502||baseline.legacyCss.gitBlobSha!=="9ae994d96118a54fe4e48411f39ec84b541478e3")
 throw Error("Protected CSS fingerprint changed without reviewed retirement");
if(!baseline.otherCss.includes("frontend/src/features/auth/components/AuthLayout.module.css"))
 throw Error("Authentication CSS Module must be explicitly reviewed in ownership baseline");
const widths=[320,360,390,768,1024,1440];
const counts=[["client",33],["admin",85],["staff",10]];
function walk(folder){
 return fs.readdirSync(folder,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?walk(path.join(folder,e.name)):e.name==="page.tsx"?1:0),0);
}
for(const [role,n] of counts)if(walk(path.join(root,"src/app",role))!==n)
 throw Error(role+" route loss in Batch C");
if(widths.length!==6)throw Error("Viewport inventory drift");
if(process.argv.includes("--built")){
 const files=[];
 function scan(p){if(!fs.existsSync(p))return;for(const e of fs.readdirSync(p,{withFileTypes:true})){
  const full=path.join(p,e.name);if(e.isDirectory())scan(full);
  else if(full.endsWith(".css"))files.push(full);
 }}
 scan(path.join(root,".next/static"));
 if(!files.length)throw Error("No compiled CSS");
 const output=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
 for(const token of ["--console-client-shortcut-columns:","--console-auth-panel-columns:","--console-workspace-gap:"])
  if(!output.includes(token))throw Error("Responsive Client/auth CSS Module token was not emitted: "+token);
}
console.log("PASS: Batch C Client overview, quick actions, billing, profile and auth use shared scoped layouts with authority unchanged.");
console.log("PENDING: 40 Client/public-auth routes x 6 viewports (240) and 810 full signed browser evidence.");
