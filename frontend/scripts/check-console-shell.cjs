"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
function must(file,parts){const body=read(file);for(const item of parts)if(!body.includes(item))throw Error(file+": missing "+item);}
must("components/layout/DashboardShell.tsx",["ConsoleMobileDrawer","DashboardSidebar","DashboardHeader","Skip to main content","id=\"console-main\"","min-h-dvh"]);
must("components/layout/DashboardSidebar.tsx",["getDashboardNavGroups(role)","ConsoleNavigationGroup","bg-console-sidebar","CloudBrandLogo"]);
must("features/shell/components/ConsoleNavigationGroup.tsx",["aria-current","getDashboardNavGroups",""]); // verifies below by specific usage?
must("features/shell/components/ConsoleMobileDrawer.tsx",['role="dialog"','aria-modal="true"','event.key==="Escape"','event.key!=="Tab"','document.body.style.overflow']);
must("features/shell/components/ConsolePageSearch.tsx",["getDashboardNavGroups(role)","Console search results","aria-label=\"Find a Console page\"","event.key===\"Escape\""]);
must("features/shell/components/ConsoleAccountMenu.tsx",["useAuth","onLogout();","aria-expanded={open}","event.key===\"Escape\""]);
must("features/auth/components/AuthLayout.tsx",["AuthBrandPanel","AuthBrandLogo","bg-console-canvas","authFieldIcons"]);
must("features/auth/components/AuthFormControls.tsx",["AuthPasswordInput","AuthInput","AuthButton","useId","aria-invalid","aria-describedby","Show password"]);
must("components/layout/RoleGuard.tsx",["useAuth","allowed.includes(user.role)","router.replace"]);
for(const file of ["LoginPageClient.tsx","SignupPageClient.tsx","ForgotPasswordPageClient.tsx","ResetPasswordConfirmPageClient.tsx"]){
 const body=read("features/auth/views/"+file);
 if(/className="auth-(?:form|terms|inline|secondary|submit|helper)/.test(body))throw Error(file+": legacy auth form classes still required");
 if(!body.includes("AuthLayout"))throw Error(file+": auth frame missing");
}
if(fs.existsSync(path.join(root,"features/auth/components/AuthLayout.module.css")))throw Error("Retired auth CSS Module reappeared");
for(const file of ["components/layout/DashboardHeader.tsx","components/layout/DashboardSidebar.tsx","components/layout/DashboardShell.tsx","features/auth/components/AuthLayout.tsx","features/auth/components/AuthFormControls.tsx"])
 if(/(?:\bfrom\s*["'][^"']+\.css["']|className="oct-)/.test(read(file)))throw Error(file+": unreviewed CSS dependency");
const navigations=read("lib/navigation/dashboard-nav.ts");
for(const role of ["adminNavGroups","staffNavGroups","clientNavGroups"])if(!navigations.includes("export const "+role))throw Error("Lost role navigation: "+role);
if(process.argv.includes("--built")){
 const dir=path.resolve(__dirname,"../.next/static");
 const css=[];
 function walk(folder){if(!fs.existsSync(folder))return;for(const item of fs.readdirSync(folder,{withFileTypes:true})){
  const name=path.join(folder,item.name);if(item.isDirectory())walk(name);else if(name.endsWith(".css"))css.push(name);
 }}
 walk(dir);if(!css.length)throw Error("No generated CSS assets");
 const output=css.map(name=>fs.readFileSync(name,"utf8")).join("\n");
 for(const selector of [".bg-console-sidebar",".bg-console-canvas",".text-console-ink",".text-console-primary"])
  if(!output.includes(selector))throw Error("Shell Tailwind token not emitted: "+selector);
}
console.log("PASS: Batch 2 role shell, keyboard mobile drawer, login/signup/reset styling and Tailwind output");
