"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src/features/admin");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const keys=["customers","products","plans","orders","invoices","domains","gateways","providers","provisioning"];
const barrel=read("data/admin-editor-config.ts");
assert.match(barrel,/Record<AdminResourceKey,AdminEditorConfig>/);
for(const key of keys){
 const name="data/editor-config/"+key+".ts",src=read(name);
 assert.ok(src.includes("export const "+key+"EditorConfig"),"resource config missing: "+key);
 assert.ok(barrel.includes("import {"+key+"EditorConfig}"),"barrel dropped: "+key);
 assert.ok(src.split("\n").length<95,"oversized resource editor config: "+key);
}
const fields=read("data/editor-config/providers.ts")+read("data/editor-config/gateways.ts");
for(const name of ["api_key","secret","secret_key","webhook_secret"]){
 assert.match(fields,new RegExp('name: "'+name+'",[^\\n]*type: "password"'),"masked secret field missing "+name);
}
const form=read("components/AdminResourceEditorForm.tsx"),parent=read("views/AdminResourceEditorView.tsx");
assert.ok(form.includes("AdminEditorFields")&&parent.includes("AdminResourceEditorForm"));
assert.ok(parent.includes("findExactAdminRecord(authorizedRows, activeId)"));
assert.ok(parent.includes("touchedFields.includes(key)"));
for(const forbidden of ["Field validation ready","Django serializer","Resource:","Record ID:"]){
 assert.ok(!form.includes(forbidden)&&!parent.includes(forbidden),"development copy still visible: "+forbidden);
}
for(const forbidden of ["adminApi","schemaApi","api.post","api.patch","fetch("]){
 assert.ok(!form.includes(forbidden),"presentation may not own write authority");
}
console.log("PASS: independent admin editor configs, compact form, existing exact-ID/changed-fields safeguards, no implementation jargon.");
