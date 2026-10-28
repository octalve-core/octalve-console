"use strict";
/** Batch B/C high-usage layout authority guard. Source + built CSS only.
 * Browser viewport proof is intentionally a separate signed gate.
 */
const fs=require("node:fs"),path=require("node:path");
const frontend=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(frontend,"src",p),"utf8");
function must(p,parts){const c=read(p);for(const item of parts)if(!c.includes(item))throw Error(p+" missing "+item);return c;}
const grid=must("components/design-system/WorkspaceGrid.tsx",["WorkspaceGridVariant","overviewPair","directory","responsive2","responsive3","responsive4","styles[variant]"]);
const css=must("components/design-system/WorkspaceGrid.module.css",[".overviewPair",".directory",".responsive2",".responsive3",".responsive4","@media (min-width: 768px)","@media (min-width: 1280px)","minmax(0, 1fr)"]);
if(css.includes(":global("))throw Error("Shared module must not create global selectors");
const responsive=must("components/data/ResponsiveGrid.tsx",["ResponsiveGrid","children","className","columns=\"3\"","WorkspaceGrid","responsive2","responsive3","responsive4"]);
for(const removed of ['"grid gap-4"','"sm:grid-cols-2 xl:grid-cols-3"']){
 if(responsive.includes(removed))throw Error("Retired global grid dependence in ResponsiveGrid: "+removed);
}
for(const role of ["admin","staff","client"]){
 const filename=role==="admin"?"AdminOverviewView.tsx":role==="staff"?"StaffDashboardView.tsx":"ClientDashboardView.tsx";
 const view=must("features/"+role+"/views/"+filename,["DashboardShell","WorkspaceGrid variant=\"overviewPair\""]);
 if(view.includes('className="grid '))throw Error(role+" overview retains unlayered generic grid");
}
for(const role of ["admin","staff"]){
 const filename=role==="admin"?"AdminQuickActions.tsx":"StaffQuickActions.tsx";
 const content=must("features/"+role+"/components/"+filename,["WorkspaceGrid variant=\"quickActions\"","ConsoleIconTile","href={href}","Quick actions"]);
 if(content.includes('className="grid '))throw Error(role+" shortcuts still use global grid");
}
const directory=must("features/admin/components/AdminSettingsDirectory.tsx",['<ul aria-label="Administration settings" className={styles.directory}',"item.href","item.key","View section"]);
if(directory.includes('className="grid '))throw Error("Admin settings still use global grid");
for(const p of [
 "features/admin/views/AdminOverviewView.tsx","features/staff/views/StaffDashboardView.tsx",
 "features/client/views/ClientDashboardView.tsx","features/admin/components/AdminSettingsDirectory.tsx",
 "components/data/ResponsiveGrid.tsx","features/admin/components/AdminQuickActions.tsx",
 "features/staff/components/StaffQuickActions.tsx"
]){
 const body=read(p);
 for(const forbidden of ["axios(","window.localStorage","markPaid(","provision(","authorizeOpanel("])
  if(body.includes(forbidden))throw Error("Presentation migration acquired authority in "+p+": "+forbidden);
}
const frozen=JSON.parse(fs.readFileSync(path.join(frontend,"audits/console-ui-baseline-2026-10-26.json"),"utf8"));
if(frozen.legacyCss.lines!==8460||frozen.legacyCss.gitBlobSha!=="4bade3c74196118a0372adc60f94dcd7fa817ad1")
 throw Error("Legacy CSS changed without owner/browser qualification");
if(!frozen.otherCss.includes("frontend/src/components/design-system/WorkspaceGrid.module.css"))
 throw Error("Shared CSS module missing from frozen audit inventory");
if(process.argv.includes("--built")){
 const dir=path.join(frontend,".next/static"),files=[];
 function walk(p){if(!fs.existsSync(p))return;for(const e of fs.readdirSync(p,{withFileTypes:true})){
  const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(f.endsWith(".css"))files.push(f);
 }}
 walk(dir);if(!files.length)throw Error("Missing compiled CSS assets");
 const body=files.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 // Minified CSS may alter whitespace; prefer stable unique class names.
 for(const token of ["overviewPair","responsive2","responsive3","responsive4"]){
  if(!body.includes(token))throw Error("Built scoped workspace CSS missing variant "+token);
 }
}
console.log("PASS: scoped cross-role overview, 4-across actions, settings and responsive grids preserve links/roles with no new business authority.");
console.log("PENDING: actual signed 135-route/810-viewport role-authenticated browser evidence.");
