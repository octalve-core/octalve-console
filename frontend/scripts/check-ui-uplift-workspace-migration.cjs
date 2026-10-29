"use strict";
/** Batch B/C high-usage layout authority guard. Source + built CSS only.
 * Browser viewport proof is intentionally a separate signed gate.
 */
const fs=require("node:fs"),path=require("node:path");
const frontend=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(frontend,"src",p),"utf8");
function must(p,parts){const c=read(p);for(const item of parts)if(!c.includes(item))throw Error(p+" missing "+item);return c;}
const grid=must("components/design-system/WorkspaceGrid.tsx",["WorkspaceGridVariant","overviewPair","directory","responsive2","responsive3","responsive4","variants[variant]"]);
if(fs.existsSync(path.join(frontend,"src/components/design-system/WorkspaceGrid.module.css")))throw Error("Retired module CSS remains in source");
if(!grid.includes('if(as==="ul")return <ul'))throw Error("Settings must remain a semantic ul in the canonical grid");
if(grid.includes(":global("))throw Error("Shared Tailwind grid must not create global selectors");
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
 const component=must("features/"+role+"/components/"+filename,['WorkspaceQuickActions role="'+role+'"']);
 if(component.includes('className="grid '))throw Error(role+" shortcuts duplicate global grid");
}
const shared=must("components/data/WorkspaceQuickActions.tsx",["WorkspaceGrid variant=\"quickActions\"","ConsoleIconTile","href={href}","Quick actions","/client/domains/register"]);
const directory=must("features/admin/components/AdminSettingsDirectory.tsx",['<WorkspaceGrid variant="directory" as="ul" ariaLabel="Administration settings"',"item.href","item.key","View section"]);
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
if(frozen.legacyCss.lines!==8460||frozen.legacyCss.gitBlobSha!=="af02677f8f5b1b06afd93be7f852a2071ce77f85")
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
 // Tailwind compiled utility must be present; old CSS-module selectors are retired.
 if(!body.includes("grid-template-columns:repeat(4,minmax(0,1fr))")&&!body.includes("grid-template-columns: repeat(4, minmax(0, 1fr))"))
  throw Error("Compiled four-column Tailwind actions layout missing");
}
console.log("PASS: Tailwind-only cross-role overview, canonical Quick Access, responsive grids and role links.");
console.log("PENDING: actual signed 135-route/810-viewport role-authenticated browser evidence.");
