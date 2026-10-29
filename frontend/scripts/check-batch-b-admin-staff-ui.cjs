"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=p=>fs.readFileSync(path.join(root,"src",p),"utf8");
function check(file,tokens){const body=src(file);
 for(const token of tokens)if(!body.includes(token))throw Error(file+": missing "+token);
 return body;
}
const grid=check("components/design-system/WorkspaceGrid.tsx",["WorkspaceGridVariant","variants[variant]","aria-busy={busy}","aria-label={ariaLabel}","adminMetrics","staffMetrics","clientMetrics","includes(variant)","2xl:grid-cols-5","2xl:grid-cols-6"]);
if(fs.existsSync(path.join(root,"src/components/design-system/WorkspaceGrid.module.css")))throw Error("Obsolete grid CSS Module returned");
const metricTile=check("components/data/WorkspaceMetricTile.tsx",["ConsoleIconTile","Panel","text-xl font-medium","shadow-"]);
const icon=check("components/design-system/IconActionButton.tsx",['aria-label={label}','type="button"','focus-visible:ring-console-primary',"disabled:opacity-50"]);
const tile=check("components/design-system/ConsoleIconTile.tsx",["LucideIcon","tone","rose:"]);
const barrel=check("components/design-system/index.ts",["WorkspaceGrid","WorkspaceGridVariant","IconActionButton"]);
const names=[
 "features/admin/components/AdminOverviewMetrics.tsx",
 "features/staff/components/StaffOverviewMetrics.tsx"
];
for(const [index,file] of names.entries()){
 const body=check(file,["WorkspaceGrid","WorkspaceMetricTile","counts[item.key]","counts[item.key]===null"]);
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
 const body=check(file,["RecordDirectory","DirectoryRow","status","records"]);
 if(body.includes('className="grid '))throw Error(file+" duplicates legacy layout");
 if(/\b(?:fetch|axios)\s*\(/.test(body))throw Error(file+" acquired data authority");
}
const tool=check("components/modules/AdminToolPage.tsx",['text-console-primary','aria-hidden="true"']);
if(tool.includes('className="stat-icon"'))throw Error("Retired stat icon consumer returned");
const global=src("app/globals.css");
if(/\.stat-icon\s*\{/.test(global))throw Error("Retired .stat-icon global rule reintroduced");
if(global.split("\n").length>300)throw Error("Global CSS exceeds approved 300-line maximum");
for(const forbidden of ["fetch(", "axios(", "localStorage", "sessionStorage"]){
 if((grid+icon+tile+metricTile).includes(forbidden))throw Error("Presentational primitive acquired backend/session authority");
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
 if(!built.includes("grid-template-columns:repeat(5,minmax(0,1fr))")&&!built.includes("grid-template-columns: repeat(5, minmax(0, 1fr))"))throw Error("Tailwind responsive five-column layout not emitted");
 for(const tok of [".bg-console-primary",".text-console-ink",".border-console-line"])
  if(!built.includes(tok))throw Error("Canonical Console styling missing: "+tok);
}
console.log("PASS: Admin/Staff shared medium KPI cards, filters, icons and Tailwind-only responsive grids.");
console.log("PENDING: 570 authenticated Admin/Staff viewport and role-interaction cases.");
