"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src"),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const logo=read("components/branding/CloudBrandLogo.tsx");
const auth=read("features/auth/components/AuthBrandLogo.tsx");
const panel=read("features/auth/components/AuthBrandPanel.tsx");
const layout=read("features/auth/components/AuthLayout.tsx");
const sidebar=read("components/layout/DashboardSidebar.tsx");
if(!fs.existsSync(path.resolve(__dirname,"../public/branding/octalve-cloud-logo.png")))
 throw Error("Approved dashboard logo asset missing");
for(const [name,body,needles] of [
 ["Shared logo",logo,["/branding/octalve-cloud-logo.png","/assets/logo/octalve.png",'variant="sidebar"','variant?:"sidebar"|"auth"',"isAuth"]],
 ["Auth logo",auth,["CloudBrandLogo",'href="/login"','variant="auth"']],
 ["Auth panel",panel,["AuthBrandLogo"]],
 ["Auth layout",layout,["AuthBrandLogo","AuthBrandPanel"]],
 ["Dashboard sidebar",sidebar,["CloudBrandLogo"]]
]){
 for(const token of needles)if(!body.includes(token))throw Error(name+" missing: "+token);
}
if(auth.includes("<img ")||auth.includes("/assets/logo/octalve.png"))
 throw Error("Authentication must reuse dashboard logo");
const data=read("components/ui/DataTable.tsx");
for(const token of ["md:hidden","md:block","<table","<caption","<RowActions","statusTone","min-w-[680px]"])
 if(!data.includes(token))throw Error("Responsive data table regression "+token);
for(const old of ['className="card"','className="table"','className="actions"'])
 if(data.includes(old))throw Error("Legacy table CSS dependency returned: "+old);
const field=read("components/ui/FormField.tsx");
for(const token of ["min-h-12","label","disabled:bg-slate-50","select","textarea","defaultValue={value??defaultValue"])
 if(!field.includes(token))throw Error("Shared form contract lost: "+token);
for(const old of ['className: "input"','className="form-field"','className="form-label"'])
 if(field.includes(old))throw Error("Legacy FormField CSS dependency returned: "+old);
const premium=read("components/modules/admin/AdminPremiumTable.tsx");
for(const token of ["export function cleanCurrency","export function getPremiumStatusTone",
 "export function PremiumStatusPill","export function AdminPremiumTable",
 "visibleRows=useMemo","searchText(row)","filterValue(row)",
 "rowActionsView(row,true)","rowActionsView(row,false)","lg:hidden","lg:block",
 "aria-expanded={openRowKey===id}","action.onClick?.(row)"])
 if(!premium.includes(token))throw Error("Premium table contract lost: "+token);
if(/className=["'][^"']*premium-(?:table|status|admin|row)/.test(premium))
 throw Error("Premium table retained legacy class dependency");
if(process.argv.includes("--built")){
 const assets=[];
 function scan(folder){if(!fs.existsSync(folder))return;
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
   const p=path.join(folder,entry.name);if(entry.isDirectory())scan(p);
   else if(p.endsWith(".css"))assets.push(p);
  }
 }
 scan(path.resolve(__dirname,"../.next/static"));
 if(!assets.length)throw Error("No compiled CSS found");
 const output=assets.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const cls of [".bg-console-primary",".text-console-ink",".border-console-line",".min-h-12"])
  if(!output.includes(cls))throw Error("Missing production Tailwind rule "+cls);
}
console.log("PASS: Shared dashboard/auth logo and responsive tables/forms preserve caller actions.");
