"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

// Test the exact production TypeScript implementation with the existing
// pinned TypeScript dependency; no runtime packages or browser credentials.
const file = path.join(__dirname, "../src/lib/api/cloud-path.ts");
const source = fs.readFileSync(file, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function("module", "exports", compiled)(loaded, loaded.exports);
const { canonicalCloudDjangoPath } = loaded.exports;

test("login and signup always use Django's canonical slash endpoint", () => {
  assert.equal(canonicalCloudDjangoPath(["auth", "jwt", "create"]), "/api/auth/jwt/create/");
  assert.equal(canonicalCloudDjangoPath(["auth", "register"]), "/api/auth/register/");
});

test("orders and nested object routes retain a single terminating slash", () => {
  assert.equal(canonicalCloudDjangoPath(["orders", "orders"]), "/api/orders/orders/");
  assert.equal(canonicalCloudDjangoPath(["billing", "invoices", "42"]), "/api/billing/invoices/42/");
});

test("route segments remain percent-encoded independently", () => {
  assert.equal(canonicalCloudDjangoPath(["catalog", "plans", "a b"]), "/api/catalog/plans/a%20b/");
});

test("the production BFF uses one identical canonical path for URL and signed IP", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/cloud/[...path]/route.ts"), "utf8");
  assert.match(route, /const djangoPath = canonicalCloudDjangoPath\(path\);/);
  assert.match(route, /const target = \`\$\{base\}\$\{djangoPath\}\$\{request\.nextUrl\.search\}\`;/);
  assert.match(route, /signedClientIpHeaders\(request, method, djangoPath\)/);
  assert.match(route, /redirect: "manual"/);
  assert.match(route, /Upstream redirect rejected\./);
});
