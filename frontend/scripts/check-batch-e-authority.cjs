"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const manifest=JSON.parse(read("lib/navigation/canonical-routes.json"));
const pages=[];
function walk(dir){
 for(const d of fs.readdirSync(dir,{withFileTypes:true})){
  const at=path.join(dir,d.name);
  if(d.isDirectory())walk(at);else if(d.name==="page.tsx"){
   const source=path.relative(path.resolve(root,"../.."),at).replaceAll(path.sep,"/");
   const segments=path.relative(path.join(root,"app"),path.dirname(at)).split(path.sep).filter(x=>x!==".");
   const route="/"+segments.filter(x=>!x.startsWith("(")).join("/");
   const role=["admin","client","staff"].includes(segments[0])?segments[0]:"public";
   pages.push({route,role,source,fixtureRequired:route.includes("[")});
  }
 }
}
walk(path.join(root,"app"));
const sorted=pages.sort((a,b)=>a.route.localeCompare(b.route));
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.routes.length,135,"Review every route change, do not claim a fixed inventory");
assert.deepEqual(manifest.expectedViewportWidths,[320,360,390,768,1024,1440]);
assert.deepEqual(sorted,manifest.routes,"Canonical manifest no longer matches actual Next app tree");
assert.equal(new Set(pages.map(x=>x.route)).size,135);
const counts=pages.reduce((o,p)=>(o[p.role]=(o[p.role]||0)+1,o),{});
assert.deepEqual(counts,{admin:85,client:33,public:7,staff:10});
assert.equal(pages.length*manifest.expectedViewportWidths.length,810);
assert.match(manifest.kind,/NOT AUTHENTICATED TEST EVIDENCE/);
const readiness=read("features/system/data/production-readiness.ts");
assert.ok(!/status: "Ready"/.test(readiness),"Static declarations cannot certify deployment");
assert.match(readiness,/browser_810_case_acceptance|135 routes × 6 viewports/);
const view=read("features/system/views/ProductionReadinessView.tsx");
assert.ok(view.includes("canonicalRouteManifest.routes.length"));
assert.ok(!view.includes("Routes audited")&&!view.includes("fallback-ready"));
const registry=read("lib/api/contract-registry.ts");
assert.equal((registry.match(/expectedOutcome:/g)||[]).length,45);
assert.equal((registry.match(/observedOutcome:/g)||[]).length,45);
assert.ok(!/status: "Aligned"\s*[,}]/.test(registry));
assert.ok(!/status: "Fallback-ready"\s*[,}]/.test(registry));
for(const name of ["Create invoice","Create domain","Create provider","Create task","Create service"]){
 const line=registry.split("\n").find(v=>v.includes('label: "'+name+'"'));
 assert.ok(line && line.includes('status: "Policy blocked"'),name+" must be classified as unavailable");
}
const policy=read("features/admin/data/admin-action-policy.ts");
for(const key of ["products","plans"])assert.ok(policy.includes("  "+key+": {"),"Generic editor must not mutate "+key);
const catalog=read("features/admin/views/CatalogAuthorityWorkbench.tsx");
assert.ok(catalog.includes("<CatalogProductsPanel"));
assert.ok(catalog.includes('throw new Error("The catalog returned an unexpected response. Please retry.")'));
assert.ok(!catalog.includes("/admin/servers/new"));
const backend=fs.readFileSync(path.resolve(root,"../../backend/orders/serializers.py"),"utf8");
assert.match(backend,/if not published:\s+raise serializers.ValidationError/);
assert.match(backend,/This hosting plan is not approved for checkout/);
const inspector=fs.readFileSync(path.resolve(root,"../../backend/accounts/management/commands/inspect_cloud_release.py"),"utf8");
assert.ok(inspector.includes("SELECT 1")&&inspector.includes('"external_certified":False'));
assert.ok(!/cursor.execute\("(DELETE|UPDATE|INSERT|ALTER|DROP)/i.test(inspector));
console.log("PASS E1–E6 source release guard: 135 canonical routes / 810 pending visual cases; 44 API labels; products and plans use one authority; no unversioned checkout; read-only inspector.");
