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
const { canonicalCloudDjangoPath, cloudUpstreamUrl } = loaded.exports;

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

test("Production login URL contains exactly one /api prefix and ends with a slash", () => {
  const base = "https://api.cloud.octalve.com/api";
  const path = canonicalCloudDjangoPath(["auth", "jwt", "create"]);
  assert.equal(cloudUpstreamUrl(base, path), "https://api.cloud.octalve.com/api/auth/jwt/create/");
  assert.equal(cloudUpstreamUrl(base, path).includes("/api/api/"), false);
});

test("Review login, signup, catalog and orders keep canonical routes and queries", () => {
  const base = "https://octalve-cloud-n1avwv1au-octalve-vault.vercel.app/api";
  assert.equal(cloudUpstreamUrl(base, canonicalCloudDjangoPath(["auth", "register"])),
    base + "/auth/register/");
  assert.equal(cloudUpstreamUrl(base, canonicalCloudDjangoPath(["catalog", "plans"]), "?page=2"),
    base + "/catalog/plans/?page=2");
  assert.equal(cloudUpstreamUrl(base, canonicalCloudDjangoPath(["orders", "orders"])),
    base + "/orders/orders/");
});

test("noncanonical upstream base and path are rejected, not redirected", () => {
  assert.throws(() => cloudUpstreamUrl("https://api.cloud.octalve.com", "/api/auth/jwt/create/"), /Invalid canonical/);
  assert.throws(() => cloudUpstreamUrl("https://api.cloud.octalve.com/api", "/auth/jwt/create/"), /Invalid canonical/);
});

test("the production BFF uses one identical canonical path for URL and signed IP", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/cloud/[...path]/route.ts"), "utf8");
  assert.match(route, /const djangoPath = canonicalCloudDjangoPath\(path\);/);
  assert.match(route, /const target = cloudUpstreamUrl\(base, djangoPath, request\.nextUrl\.search\);/);
  assert.match(route, /signedClientIpHeaders\(request, method, djangoPath\)/);
  assert.match(route, /redirect: "manual"/);
  assert.match(route, /Upstream redirect rejected\./);
});

test("authenticated email readiness GET is allowlisted without opening other auth methods", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/cloud/[...path]/route.ts"), "utf8");
  const allowlist = route.match(/const ALLOWED_AUTH_PATHS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(allowlist, "Expected an explicit BFF authentication route allowlist");
  assert.match(allowlist[1], /"auth\/email\/verification\/status"/);
  assert.match(route, /if \(apiPath === "auth\/email\/verification\/status" && method !== "GET"\) \{\s*return error\(405, "Method not allowed\."\);/);
  const endpoints = fs.readFileSync(path.join(__dirname, "../src/lib/api/endpoints.ts"), "utf8");
  assert.match(endpoints, /api\.get<\{email_verified:boolean;delivery_configured:boolean\}>\("\/auth\/email\/verification\/status\/"\)/);
  const backend = fs.readFileSync(path.join(__dirname, "../../backend/accounts/urls.py"), "utf8");
  assert.match(backend, /path\('email\/verification\/status\/', AccountEmailDeliveryStatusView\.as_view\(\)/);
  assert.equal(
    cloudUpstreamUrl("https://api.cloud.octalve.com/api", canonicalCloudDjangoPath(["auth", "email", "verification", "status"])),
    "https://api.cloud.octalve.com/api/auth/email/verification/status/",
  );
});


test("BFF refuses password-only success for an explicit passkey exchange", async () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/cloud/[...path]/route.ts"), "utf8");
  const compiledRoute = ts.transpileModule(route, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  let cookies = 0;
  let calls = 0;
  let payload = {access:"synthetic-access", refresh:"synthetic-refresh"};
  const next = {json: (body, options) => ({body, status:options.status, headers:options.headers})};
  const session = {SESSION_ACCESS_COOKIE:"access", SESSION_REFRESH_COOKIE:"refresh",
    clearSessionCookies(){}, resolveCloudApiBase:()=>"https://api.cloud.octalve.com/api",
    sameOriginRequest:()=>true, signedClientIpHeaders:()=>({}), setSessionCookies(){cookies++;}};
  const mod = {exports:{}};
  const vm = require("node:vm");
  vm.runInNewContext(compiledRoute, {exports:mod.exports, require:name=>{
    if(name==="next/server")return {NextResponse:next};
    if(name==="@/lib/api/cloud-path")return {canonicalCloudDjangoPath,cloudUpstreamUrl};
    if(name==="@/lib/api/server-session")return session;
    throw Error(name);
  }, Headers, AbortSignal, TextDecoder, fetch:async url=>{
    calls++;
    return {ok:true,status:200,json:async()=>url.endsWith("/users/me/")?{id:1,role:"admin"}:payload};
  }});
  const request = () => {
    const bytes = new TextEncoder().encode(JSON.stringify({email:"fixture@example.invalid",password:"fixture",passkey_qualification:true}));
    return {method:"POST",nextUrl:new URL("https://console.cloud.octalve.com/api/cloud/auth/jwt/create"),
      cookies:{get:()=>undefined},headers:new Headers({"content-type":"application/json"}),
      arrayBuffer:async()=>bytes.buffer};
  };
  const context={params:Promise.resolve({path:["auth","jwt","create"]})};
  let result=await mod.exports.POST(request(),context);
  assert.equal(result.status,502);
  assert.equal(cookies,0);
  assert.equal(calls,1,"unverified response must not reach identity exchange");
  payload={...payload,passkey_verified:true};
  result=await mod.exports.POST(request(),context);
  assert.equal(result.status,200);
  assert.equal(cookies,1);
  assert.equal(result.body.user.id,1);
});
