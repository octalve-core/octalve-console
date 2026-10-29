"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=p=>fs.readFileSync(path.join(root,"src",p),"utf8");
function check(file,tokens){const body=src(file);
 for(const token of tokens)if(!body.includes(token))throw Error(file+": missing "+token);
 return body;
}
const grid=check("components/design-system/WorkspaceGrid.tsx",["WorkspaceGridVariant","styles[variant]","aria-busy={busy}","aria-label={ariaLabel}","adminMetrics","staffMetrics","clientMetrics","includes(variant)"]);
const gridCss=check("components/design-system/WorkspaceGrid.module.css",[".filters",".adminMetrics",".staffMetrics","--console-workspace-gap","@media (min-width: 1536px)"]);
const icon=check("components/design-system/IconActionButton.tsx",['aria-label={label}','type="button"','focus-visible:ring-console-primary',"disabled:opacity-50"]);
const tile=check("components/design-system/ConsoleIconTile.tsx",["LucideIcon","tone","rose:"]);
const barrel=check("components/design-system/index.ts",["WorkspaceGrid","WorkspaceGridVariant","IconActionButton"]);
const names=[
 "features/admin/components/AdminOverviewMetrics.tsx",
 "features/staff/components/StaffOverviewMetrics.tsx"
];
for(const [index,file] of names.entries()){
 const body=check(file,["WorkspaceGrid","ConsoleIconTile","counts[item.key]","value===null","Panel","min-h-[108px]"]);
 if(!body.includes(index===0?'variant="adminMetrics"':'variant="staffMetrics"'))
  throw Error(file+" uses wrong role-responsive layout variant");
 if(body.includes("item.accent")||body.includes('className="grid '))
  throw Error(file+" retains legacy metric icon/layout styling");
}
for(const file of [
 "features/admin/components/AdminGenericDirectory.tsx",
 "features/admin/components/AdminResourceDirectory.tsx",
 "features/staff/components/StaffOperationalDirectory.tsx"
]){
 const body=check(file,['WorkspaceGrid variant="filters"',"ResponsiveTable","StatusBadge","TextField","SelectField","PAGE_SIZE=10","<Panel"]);
 if(body.includes('className="grid '))throw Error(file+" filters still use collision-prone legacy .grid");
 if(/\b(?:fetch|axios)\s*\(/.test(body))throw Error(file+" acquired data authority");
}
const tool=check("components/modules/AdminToolPage.tsx",['text-console-primary','aria-hidden="true"']);
if(tool.includes('className="stat-icon"'))throw Error("Retired stat icon consumer returned");
const global=src("app/globals.css");
if(/\.stat-icon\s*\{/.test(global))throw Error("Retired .stat-icon global rule reintroduced");
if(global.split("\n").length>300)throw Error("Global CSS exceeds approved 300-line maximum");
for(const forbidden of ["fetch(", "axios(", "localStorage", "sessionStorage"]){
 if((grid+icon+tile).includes(forbidden))throw Error("Presentational primitive acquired backend/session authority");
}
const files=fs.readdirSync(path.join(root,"src/app/admin"),{withFileTypes:true});
if(process.argv.includes("--built")){
 const assets=[],dir=path.join(root,".next/static");
 function walk(p){if(!fs.existsSync(p))return;for(const x of fs.readdirSync(p,{withFileTypes:true})){
  const full=path.join(p,x.name);if(x.isDirectory())walk(full);else if(full.endsWith(".css"))assets.push(full);
 }}
 walk(dir);
 if(!assets.length)throw Error("No compiled CSS assets");
 const built=assets.map(x=>fs.readFileSync(x,"utf8")).join("\n");
 if(!built.includes("--console-workspace-gap:"))throw Error("Scoped Admin/Staff responsive layout not emitted");
 for(const tok of [".bg-console-primary",".text-console-ink",".border-console-line"])
  if(!built.includes(tok))throw Error("Canonical Console styling missing: "+tok);
}
console.log("PASS: Batch B Admin/Staff shared metrics, filters, icons, responsive scoped CSS and exact two-rule legacy retirement.");
console.log("PENDING: 570 authenticated Admin/Staff viewport and role-interaction cases.");
