"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src"),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const r=read("lib/routes.ts"),nav=read("lib/navigation/dashboard-nav.ts");
assert.ok(r.includes('integrations: "/admin/integrations"')&&nav.includes('href: routes.admin.integrations'));
assert.ok(r.includes('category: "/admin/catalog/workbench"'),"Broken Category link");
const page=read("app/admin/integrations/page.tsx"),store=read("features/admin/integrations/IntegrationStore.tsx");
const sheet=read("features/admin/integrations/ProviderSideSheet.tsx");
assert.match(page,/Suspense/);assert.match(store,/role="admin"/);
assert.match(sheet,/showModal\(\)/);assert.match(sheet,/onClose=\{onClose\}/);
assert.match(sheet,/aria-labelledby/);assert.match(sheet,/close\(\)/);
assert.ok(!/fetch\(|api\.post|api\.patch|localStorage|sessionStorage|type="password"/.test(store+sheet),"Store must not send or collect secrets");
const sections=["hosting","domains","services","email","cloud"];
const manifest=sections.map(x=>read("features/admin/integrations/catalog/"+x+".ts")).join("\n");
const slugs=[...manifest.matchAll(/"slug": "([^"]+)"/g)].map(m=>m[1]);
const guides=[...manifest.matchAll(/"documentation": "([^"]+)"/g)].map(m=>m[1]);
assert.equal(slugs.length,21);assert.equal(new Set(slugs).size,slugs.length);
assert.equal(guides.length,slugs.length);assert.ok(guides.every(s=>s.startsWith("https://")));
for(const file of sections)assert.ok(read("features/admin/integrations/catalog/"+file+".ts").split("\n").length<200);
const list=read("features/admin/data/admin-resource-config.ts");
assert.ok(list.includes('createHref: "/admin/integrations"'));
assert.ok(read("app/admin/servers/new/page.tsx").includes('redirect("/admin/integrations")'));
assert.ok(read("features/admin/views/AdminResourceDetailView.tsx").includes('resource==="providers"?[]'));
const types=read("features/admin/integrations/catalog/types.ts");
assert.ok(types.includes("sensitive?:boolean")&&types.includes("documentation:string"));
const allFiles=new Set();
function walk(d,rel=""){for(const e of fs.readdirSync(d,{withFileTypes:true})){const name=rel?rel+"/"+e.name:e.name,p=path.join(d,e.name);if(e.isDirectory())walk(p,name);else if(e.name==="page.tsx")allFiles.add("/"+rel);}}
walk(path.join(root,"app/admin"),"admin");
assert.equal(allFiles.size,85,"Expected 85 Admin pages including Integration Store");
const links=[...nav.matchAll(/href: routes\.admin\.(\w+)/g)].map(m=>m[1]);
for(const key of links){
 const match=r.match(new RegExp(key+': "(\\/admin[^"]*)"'));
 assert.ok(match,"Missing sidebar route definition: "+key);
 assert.ok(allFiles.has(match[1]),"Sidebar leads to missing Admin page: "+match[1]);
}
const linksFromSettings=read("features/admin/components/AdminSettingsSectionPanel.tsx");
assert.ok(linksFromSettings.includes('href:"/admin/integrations"'));
for(const name of ["cpanel","cloudflare","digitalocean","hetzner","namecheap","zoho","googlecloud","letsencrypt","resend","plesk","vultr","proxmox"]){
 const asset=path.join(root,"..","public/integrations",name+".svg");
 assert.ok(fs.existsSync(asset),"Missing local vendor mark "+name);
 const svg=fs.readFileSync(asset,"utf8");
 assert.ok(svg.startsWith("<svg")&&!/script|foreignObject|onload=|href=/.test(svg),"Unsafe vendor mark "+name);
}
console.log("PASS: 85 Admin destinations, fixed Category and Integration navigation, 21 unique manifests and valid guides, read-only side sheet, local vetted logos.");
