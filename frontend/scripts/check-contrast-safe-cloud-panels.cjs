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
  ["components/data/WorkspaceWelcomePanel.tsx",["aria-label=\"Console welcome\"","text-console-ink","text-console-muted","font-medium"]],
  ["features/client/components/ClientDomainSearch.tsx",["bg-slate-50","text-slate-950"]],
  ["features/client/components/domain-search/DomainSearchForm.tsx",["items-center","gap-3","focus-within:border-[#0064E0]"]],
  ["features/client/components/KnowledgeBaseHero.tsx",["bg-white","text-slate-950"]],
  ["components/branding/CloudBrandLogo.tsx",["max-w-[133px]","px-14"]]
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

const domainForm=fs.readFileSync(path.join(root,"features/client/components/domain-search/DomainSearchForm.tsx"),"utf8");
if(!domainForm.includes('className="grid min-w-0 gap-3 sm:grid-cols-3') ||
   !domainForm.includes('className="flex h-14 min-h-14 w-full min-w-0 items-center sm:col-span-2') ||
   !domainForm.includes('className="h-5 w-5 shrink-0') ||
   !domainForm.includes('className="block h-12 min-h-12 w-full min-w-0 flex-1') ||
   !domainForm.includes('htmlFor="client-domain-search"') ||
   domainForm.includes("absolute left-") || domainForm.includes("translate-y-1/2")){
 throw new Error("Domain search icon and text must share an in-flow, vertically centered flex row");
}
// Batch 5 extracted the forms into typed Tailwind sections. Keep enforcing
// responsive layout and 48px controls at their actual component boundaries.
const supportViews=[
 ["features/client/views/ClientSupportTicketEditorView.tsx",["WorkspaceGrid variant=\"supportColumns\"","xl:col-span-2","SupportRequestFields"]],
 ["features/support/components/SupportRequestFields.tsx",["SelectField","TextField","TextAreaField","min-h-48","sm:w-auto"]],
 ["components/modules/TicketConversationView.tsx",["xl:grid-cols-3","xl:col-span-2","TicketReplyComposer","TicketContextPanels"]],
 ["features/support/components/TicketReplyComposer.tsx",["TextAreaField","min-h-40","sm:w-auto"]],
 ["components/modules/SupportTeamSettingsView.tsx",["xl:grid-cols-3","xl:col-span-2","SupportRoutingCreateForms","SelectField"]],
 ["components/modules/SupportDeskView.tsx",["SupportTicketCards","TextField"]],
 ["components/design-system/TextField.tsx",["h-12 min-h-12","focus-within:border-console-primary"]],
 ["components/design-system/SelectField.tsx",["h-12 min-h-12","focus:border-console-primary"]]
];
for(const [filename,utilities] of supportViews){
 const content=fs.readFileSync(path.join(root,filename),"utf8");
 if(content.includes("xl:grid-cols-["))throw Error(filename+": unreliable arbitrary desktop grid must not return");
 for(const utility of utilities)if(!content.includes(utility))
  throw Error(filename+": missing responsive support form utility "+utility);
}
const scoped=fs.readFileSync(path.join(root,"components/design-system/WorkspaceGrid.module.css"),"utf8");
if(!scoped.includes(".supportColumns")||!scoped.includes("@media (min-width: 1280px)"))
 throw Error("Client support must retain three-column desktop grid in locally scoped CSS");
const welcome=fs.readFileSync(path.join(root,"components/data/WorkspaceWelcomePanel.tsx"),"utf8");
if(!welcome.includes('eyebrow:"Your Octalve Cloud Console"') ||
   /eyebrow:"[^"]*workspace"/i.test(welcome) ||
   !welcome.includes('aria-label="Console welcome"')){
 throw new Error("Welcome copy must identify Octalve Console, not Workspace");
}
const header=fs.readFileSync(path.join(root,"components/layout/DashboardHeader.tsx"),"utf8");
if(/(?:Client|Admin|Staff) workspace|Workspace search results|Find a workspace page/i.test(header)){
 throw new Error("Dashboard navigation must consistently use Console terminology");
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
 for(const selector of [".bg-white", ".text-slate-950", ".bg-slate-50", ".h-12", ".h-14", ".min-h-12", ".min-h-14", ".xl\\:grid-cols-3", ".xl\\:col-span-2"]){
   if(!output.includes(selector))throw new Error(`Tailwind build missing class ${selector}`);
 }
 console.log(`PASS: ${css.length} CSS asset(s) emitted with critical Cloud panel utility classes`);
}
console.log("PASS: workspace, domain, knowledge and brand panels use contrast-safe TypeScript/Tailwind classes");
