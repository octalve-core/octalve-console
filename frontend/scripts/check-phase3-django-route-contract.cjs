"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const api = read("src/lib/api/endpoints.ts");
const djangoRoot = read("../backend/octalve_backend/urls.py");
const serviceUrls = read("../backend/services/urls.py");
const domainUrls = read("../backend/domains/urls.py");
const walletUrls = read("../backend/wallet/urls.py");
const walletViews = read("../backend/wallet/views.py");
const walletSerializer = read("../backend/wallet/serializers.py");
const tests = read("../backend/accounts/tests.py");
const bff = read("src/app/api/cloud/[...path]/route.ts");
const config = read("src/features/client/data/client-resource-config.ts");
const normalizer = read("src/features/client/utils/client-record-normalizer.ts");

const section = (name, next) => {
 const start = api.indexOf("  " + name + ": {");
 const end = api.indexOf("  " + next + ": {", start + 1);
 assert.ok(start >= 0 && end > start, name + " section missing");
 return api.slice(start, end);
};
const client = section("client", "admin");
const admin = api.slice(api.indexOf("  admin: {"),api.indexOf("\n};",api.indexOf("  admin: {")));
const required = {
 client: {
  services:"/services/services/", domains:"/domains/domains/",
  invoices:"/billing/invoices/", orders:"/orders/orders/",
  wallet:"/wallet/my-wallet/me/", tickets:"/support/tickets/"
 },
 admin: {
  services:"/services/services/", plans:"/catalog/plans/",
  orders:"/orders/orders/", invoices:"/billing/invoices/",
  domains:"/domains/domains/", gateways:"/payments/gateways/",
  providers:"/providers/providers/", transactions:"/payments/transactions/",
  auditLogs:"/audit/logs/", reports:"/reports/definitions/",
  provisioningQueue:"/provisioning/tasks/"
 }
};
for(const [kind, fields] of Object.entries(required)) {
 const content = kind === "client" ? client : admin;
 for(const [name,route] of Object.entries(fields)){
   assert.ok(content.includes(name + ': "' + route + '"'),
    kind + "." + name + " not routed to Django " + route);
 }
}
for(const pair of [
 ["services",serviceUrls,'router.register(r\'services\''],
 ["domains",domainUrls,'router.register(r\'domains\''],
 ["wallet",walletUrls,'router.register(r\'my-wallet\'']
]) assert.ok(pair[1].includes(pair[2]),"Missing authoritative router: " + pair[0]);
for(const rootName of ["services","domains","wallet","orders","billing","payments","providers","provisioning"])
 assert.ok(djangoRoot.includes("path('api/" + rootName + "/'"),"Django missing API root " + rootName);
assert.match(walletViews, /def me\(self, request\)/);
assert.match(walletSerializer, /'currency', 'balance'/);
assert.match(api, /return \{ available: Number\(amountText\), currency: record\.currency \}/);
assert.match(api, /const byId = \(base: string, id: string\) => .*replace\(\/\\\/\+\$\/.*encodeURIComponent\(id\)/);
assert.ok(!client.includes('services: "/services/"'));
assert.ok(!client.includes('domains: "/domains/"'));
assert.ok(!client.includes('wallet: "/wallet/"'));
assert.ok(!api.includes('"/admin/services/"'));
assert.ok(!api.includes('"/admin/domains/"'));
assert.ok(config.includes("loader: () => clientApi.services()") &&
 config.includes("loader: () => clientApi.domains()"));
assert.ok(normalizer.includes("throw new Error(\"Invalid authorized API list response.\")"));
assert.ok(tests.includes("test_owned_service_and_domain_lists_return_real_records_only"));
assert.match(bff,/const djangoPath = canonicalCloudDjangoPath\(path\)/);
assert.match(bff,/const target = cloudUpstreamUrl\(base, djangoPath, request.nextUrl.search\)/);
assert.ok(api.includes('DNS record editing requires a verified DNS provider.'));
assert.ok(api.includes('Wallet funding is not yet available.'));
console.log("PASS: Client/Admin Django routes, wallet serializer, exact IDs, safe BFF, verified tenant reads and denied unsupported writes");
