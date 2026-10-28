"use strict";
const fs=require("node:fs"),path=require("node:path");
const frontend=path.resolve(__dirname,"..");
const src=path.join(frontend,"src");
const old=path.join(frontend,"tailwind.config.js");
const configPath=path.join(frontend,"tailwind.config.ts");
const globals=path.join(src,"app/globals.css");
const postcssPath=path.join(frontend,"postcss.config.mjs");
if(fs.existsSync(path.join(frontend,"postcss.config.js")))throw Error("Duplicate PostCSS config must not return");
if(!fs.existsSync(postcssPath))throw Error("Canonical PostCSS MJS config missing");
const postcss=fs.readFileSync(postcssPath,"utf8");
if(!postcss.includes("tailwindcss: {}")||!postcss.includes("autoprefixer: {}"))throw Error("Canonical Tailwind v3 PostCSS plugins missing");

if(fs.existsSync(old))throw Error("Duplicate Tailwind JS config returned");
if(!fs.existsSync(configPath))throw Error("Canonical TypeScript Tailwind config missing");
const config=fs.readFileSync(configPath,"utf8");
for(const token of ["import type { Config } from \"tailwindcss\"",
 "./src/**/*.{js,ts,jsx,tsx,mdx}","#0064E0","#0052B8",
 "#071425","#000A16","#E5EBF3","bg-console-primary"])
 if(!config.includes(token))throw Error("TypeScript Tailwind configuration lost: "+token);
const layout=fs.readFileSync(path.join(src,"app/layout.tsx"),"utf8");
if(!layout.includes('import "./globals.css"'))throw Error("Unqualified CSS removal: RootLayout still requires the compatibility sheet");
if(!fs.existsSync(globals))throw Error("Premature globals.css removal");
const css=fs.readFileSync(globals,"utf8");
if(css.split("\n").length!==8502)throw Error("Protected compatibility stylesheet changed without CSS retirement qualification");
if((css.match(/\.error-alert\s*\{/g)||[]).length!==1)throw Error("Duplicate legacy alert rule returned");
for(const selector of [".page-container",".premium-table",".checkout-v2-header",".domain-search-v2",".oct-topbar"])
 if(!css.includes(selector))throw Error("Existing compatibility selector changed: "+selector);
function routes(folder){
 if(!fs.existsSync(folder))return 0;
 return fs.readdirSync(folder,{withFileTypes:true}).reduce((count,e)=>{
  const p=path.join(folder,e.name);
  return count+(e.isDirectory()?routes(p):e.name==="page.tsx"?1:0);
 },0);
}
const expected=[["admin",85],["client",33],["staff",10]];
let total=0;
for(const [role,count] of expected){
 const actual=routes(path.join(src,"app",role));if(actual!==count)throw Error(role+" route regression: expected "+count+" got "+actual);
 total+=actual;
}
const rest=routes(path.join(src,"app"))-total;
if(rest!==7)throw Error("Public/auth route regression: expected 7 got "+rest);
if(process.argv.includes("--built")){
 const folder=path.join(frontend,".next/static"),assets=[];
 function scan(root){
  if(!fs.existsSync(root))return;
  for(const e of fs.readdirSync(root,{withFileTypes:true})){
   const file=path.join(root,e.name);if(e.isDirectory())scan(file);else if(file.endsWith(".css"))assets.push(file);
  }
 }
 scan(folder);if(!assets.length)throw Error("No compiled stylesheet emitted");
 const built=assets.map(file=>fs.readFileSync(file,"utf8")).join("\n");
 for(const rule of [".bg-console-primary",".text-console-ink",".border-console-line",".page-container"])
  if(!built.includes(rule))throw Error("Missing required pre-retirement styling in compiled output: "+rule);
}
console.log("PASS: Batch 8 foundation: one TS Tailwind config; 135 routes; protected compatibility CSS safely retained.");
console.log("NOT QUALIFIED: Removing globals.css remains blocked pending zero legacy consumers and authenticated browser parity.");
