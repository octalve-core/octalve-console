"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const config=read("features/admin/workspace/data/admin-workspace-config.ts");
const view=read("features/admin/workspace/views/AdminWorkspaceView.tsx");
const panel=read("features/admin/workspace/components/AdminWorkspaceConnectionStatus.tsx");
if((config.match(/loader: emptyLoader,/g)||[]).length!==9)
 throw Error("Unsupported workspace inventory changed; review API contracts first.");
if((config.match(/availability: "unconnected"/g)||[]).length!==8)
 throw Error("Unconnected Admin workspace pages must be identified explicitly.");
if((config.match(/availability: "navigation"/g)||[]).length!==1)
 throw Error("Billing navigation hub must be the only navigation-only workspace.");
const billing=config.slice(config.indexOf('  billing: {'),config.indexOf('  "billing-services": {'));
if(!billing.includes('availability: "navigation"'))throw Error("Billing hub no longer truthful");
for(const token of [
 "config.availability && config.availability !== \"api\"",
 "setRecords([])","setIsLoading(false)",
 "AdminWorkspaceConnectionStatus","const response = await config.loader()",
 "setRecords(apiRecords)","AdminGenericDirectory"
])if(!view.includes(token))throw Error("Admin workspace API/availability guard missing "+token);
for(const url of [
 "/admin/billing/invoices","/admin/billing/transactions","/admin/billing/services",
 "/admin/billing/domains","/admin/gateways","/admin/support",
 "/admin/support/departments"
])if(!panel.includes(url))throw Error("Billing/support link removed "+url);
if(!panel.includes("is not connected yet")||
 !panel.includes("This section is being prepared.")||
 !panel.includes("Explore the available tools below."))
 throw Error("Unavailable workspaces must disclose the restriction in professional copy.");
if(/schemaApi|adminApi|fetch\s*\(/.test(panel))throw Error("Navigation components must not own API requests");
const packageConfig=fs.readFileSync(path.resolve(__dirname,"../tailwind.config.ts"),"utf8");
if(!packageConfig.includes("./src/features/admin/**/*.{js,ts,jsx,tsx,mdx}"))
 throw Error("New workspace components not included in Tailwind scan");
if(process.argv.includes("--built")){
 const rootCss=path.resolve(__dirname,"../.next/static"),styles=[];
 function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith(".css"))styles.push(p);
 }}walk(rootCss);
 if(!styles.length)throw Error("No compiled CSS found");
 const css=styles.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const token of [".bg-console-primary",".border-console-line",".text-console-ink"])
  if(!css.includes(token))throw Error("Missing workspace Tailwind utility "+token);
}
const quoteBlock=config.slice(config.indexOf("  quotes: {"),config.indexOf('  "billing-batch": {'));
if(!quoteBlock.includes("loader: () => adminApi.quotes()")||!quoteBlock.includes('availability: "api"'))
 throw Error("Quotes must use the existing owned API, not demo data");
if(!read("lib/api/endpoints.ts").includes('"/billing/quotes/"'))throw Error("Existing Django quote API route is missing");
const previewBlock=config.slice(config.indexOf('  "billing-batch": {'),config.indexOf('  "print-queue": {'));
if(!previewBlock.includes("loader: () => adminApi.renewalPreview()")||!previewBlock.includes('availability: "api"'))
 throw Error("Renewal review must be backed by the safe admin API");
if(!read("features/admin/workspace/views/AdminWorkspaceView.tsx").includes('"quote_number"'))
 throw Error("Quote number must remain visible in Admin listing");
const staffBlock=config.slice(config.indexOf("  staff: {"),config.indexOf("  blacklist: {"));
if(!staffBlock.includes("loader: () => adminApi.staffRoster()")||!staffBlock.includes('availability: "api"'))
 throw Error("Staff roster must come from the reviewed read-only API");
console.log("PASS: 8 unconnected workspace loaders remain disclosed; Staff, Quotes and Renewals are read-only API-backed.");
