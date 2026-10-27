"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src"),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const page=read("app/admin/gateways/paystack/page.tsx");
const payments=read("features/admin/views/AdminPaymentGatewayOverviewView.tsx");
if(!page.includes("AdminPaymentGatewayOverviewView")||page.includes("ResourceEditor"))
 throw Error("Paystack page returned to the unconnected Save form");
for(const token of ["schemaApi.payments.gateways()","role=\"admin\"","state.loading","Gateway records are temporarily unavailable",
 "current.status","Payment readiness","View gateway record"])
 if(!payments.toLowerCase().includes(token.toLowerCase()))
  throw Error("Paystack server-backed, read-only contract missing: "+token);
for(const legacy of ["secret_key","webhook_secret","public_key","<form","type=\"password\"","localStorage"])
 if(payments.includes(legacy)||page.includes(legacy))
  throw Error("Paystack record overview must not collect, store or expose credentials: "+legacy);
const fields=read("features/admin/data/admin-editor-config.ts");
for(const name of ["secret_key","webhook_secret","api_key","secret"]){
 const expression=new RegExp("name: \\\""+name+"\\\"[^\\n]*type: \\\"password\\\"");
 if(!expression.test(fields))throw Error("Sensitive admin editor field must be password-masked: "+name);
}
const editorFields=read("features/admin/components/AdminEditorFields.tsx");
if(!editorFields.includes('autoComplete={field.type==="password"?"new-password":undefined}'))
 throw Error("Sensitive Admin inputs lack password autocomplete control");
const editor=read("features/admin/views/AdminResourceEditorView.tsx");
for(const token of ["setSourceRecord(foundApiRecord ?? null)","sourceRecord?.id !== activeId",
 'setError("This record is not available in your authorized account.',"effectiveMode === \"edit\" && (!sourceRecord || sourceRecord.id !== activeId)",
 "saveAdminResourceRecord(resource, effectiveMode, payload"])
 if(!editor.includes(token))throw Error("Authorized API edit gate missing: "+token);
if(editor.includes("listConfig.fallback")||editor.includes("prefilled with fallback"))
 throw Error("Edit form could submit synthetic fallback records");
const workspace=read("features/admin/workspace/views/AdminWorkspaceEditorView.tsx");
for(const token of ["This operation is not available yet","config.listHref",'role="admin"'])
 if(!workspace.includes(token))throw Error("Unsupported workspace operation must be visibly unavailable");
for(const forbidden of ["<form","setTimeout","setIsSubmitting","Save</","config.fallback"])
 if(workspace.includes(forbidden))throw Error("Unverified workspace Save or demo data returned: "+forbidden);
const listings=read("features/admin/workspace/views/AdminWorkspaceView.tsx");
if(listings.includes("config.createHref?<ActionLink")||listings.includes("config.createLabel??\"Create\""))
 throw Error("Unsupported Admin workspace Create affordance returned");
if(process.argv.includes("--built")){
 const output=path.resolve(__dirname,"../.next/static");const assets=[];
 function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith(".css"))assets.push(p);
 }}walk(output);
 if(!assets.length)throw Error("Compiled Tailwind CSS missing");
 const s=assets.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const cls of [".text-console-ink",".border-console-line",".bg-console-primary"])
  if(!s.includes(cls))throw Error("Tailwind utility missing "+cls);
}
console.log("PASS: Paystack API readback, masked gateway secrets, exact-ID edit authority, no simulated workspace saves.");
