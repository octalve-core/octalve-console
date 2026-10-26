/* Cloud Console visual regression guard.
 * In particular, the October 2026 deployment repeatedly showed white text on
 * white panels after gradients failed to render. Never couple legibility of
 * workspace banners to a background image utility or the legacy global CSS.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../src");
const paths=[
  ["components/data/WorkspaceWelcomePanel.tsx",["bg-white","text-slate-950"]],
  ["features/client/components/ClientDomainSearch.tsx",["bg-slate-50","text-slate-950"]],
  ["features/client/components/KnowledgeBaseHero.tsx",["bg-white","text-slate-950"]],
  ["components/branding/CloudBrandLogo.tsx",["max-w-[140px]","px-9"]]
];
for(const [filename,tokens] of paths){
 const content=fs.readFileSync(path.join(root,filename),"utf8");
 for(const token of tokens){
   if(!content.includes(token))throw new Error(`${filename}: missing visual contract ${token}`);
 }
 if(/bg-gradient-|linear-gradient\(/.test(content))
   throw new Error(`${filename}: gradient-dependent backgrounds must not return`);
}
const wrappers=[
 "features/client/components/ClientHero.tsx",
 "features/admin/components/AdminHero.tsx",
 "features/staff/components/StaffHero.tsx"
];
for(const filename of wrappers){
 const text=fs.readFileSync(path.join(root,filename),"utf8");
 if(!text.includes("WorkspaceWelcomePanel"))
  throw new Error(`${filename}: shared workspace hero missing`);
}
if(process.argv.includes("--built")){
 const staticDir=path.resolve(__dirname,"../../.next");
 const candidates=[path.resolve(__dirname,"../.next"),staticDir];
 const css=[];
 function scan(dir){
   if(!fs.existsSync(dir))return;
   for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
     const p=path.join(dir,ent.name);
     if(ent.isDirectory())scan(p);
     else if(ent.name.endsWith(".css"))css.push(p);
   }
 }
 for(const candidate of candidates)scan(path.join(candidate,"static"));
 if(css.length===0)throw new Error("No generated CSS found. Unable to qualify workspace styling.");
 const output=css.map(f=>fs.readFileSync(f,"utf8")).join("\n");
 for(const selector of [".bg-white", ".text-slate-950", ".bg-slate-50"]){
   if(!output.includes(selector))throw new Error(`Tailwind build missing class ${selector}`);
 }
 console.log(`PASS: ${css.length} CSS asset(s) emitted with critical Cloud panel utility classes`);
}
console.log("PASS: workspace, domain, knowledge and brand panels use contrast-safe TypeScript/Tailwind classes");
