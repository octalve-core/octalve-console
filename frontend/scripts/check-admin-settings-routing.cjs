"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const config=get("features/admin/settings/data/admin-settings-config.ts");
const links=get("features/admin/components/AdminSettingsSectionPanel.tsx");
const nav=get("lib/navigation/dashboard-nav.ts");
const routes=get("lib/routes.ts");
const layout=get("app/admin/layout.tsx");
const operation=get("features/admin/operations/data/admin-operations-config.ts");
const newPage=get("app/admin/settings/notifications/new/page.tsx");
assert.match(nav,/href:\s*routes\.admin\.settings/);
assert.match(routes,/settings:\s*"\/admin\/settings"/);
assert.match(layout,/RoleGuard allowed=\{\["admin"\]\}/);
const keys=[...config.matchAll(/key:\s*"([a-z-]+)",\s*\n\s*title:/g)].map(x=>x[1]);
assert.equal(keys.length,14,"Expected all 14 Admin Settings sections");
assert.equal(new Set(keys).size,14,"Duplicate Admin Settings sections");
for(const key of keys){
 const href="/admin/settings/"+key;
 assert.ok(config.includes('href: "'+href+'"'),"Settings link missing: "+key);
 assert.ok(fs.existsSync(path.join(root,"app",href.slice(1),"page.tsx")),"Settings target missing: "+href);
 const route=get(path.join("app",href.slice(1),"page.tsx"));
 if(key!=="notifications")assert.ok(route.includes('section="'+key+'"'),"Wrong view section for "+href);
}
const targets=[...links.matchAll(/href:"(\/admin\/[^"]+)"/g)].map(x=>x[1]);
assert.ok(targets.includes("/admin/servers")&&targets.includes("/admin/gateways")&&targets.includes("/admin/billing/domains"),
 "Hosting, payment and domain management must be distinct");
for(const href of targets)assert.ok(fs.existsSync(path.join(root,"app",href.slice(1),"page.tsx")),"Settings management link is not a real route: "+href);
const notifications=operation.slice(operation.indexOf('  notifications: {'),operation.lastIndexOf('};'));
assert.ok(!notifications.includes("createHref:"),"Unqualified notification template create action advertised");
assert.ok(!newPage.includes("AdminOperationEditorView")&&newPage.includes('redirect("/admin/settings/notifications")'),
 "Legacy notification create link must fail safe to list");
assert.ok(!config.includes('status: "Ready"'),"Static Settings overview incorrectly claims operational readiness");
console.log("PASS: 14 admin-only Settings routes, valid management links, separate provider/gateway/domain paths, no unqualified notification Save.");
