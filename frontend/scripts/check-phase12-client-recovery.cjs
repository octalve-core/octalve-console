"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../src");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const list = read("features/client/views/ClientResourceListView.tsx");
const client = read("lib/api/client.ts");
const proxy = read("app/api/cloud/[...path]/route.ts");
const error = read("components/feedback/ErrorState.tsx");
const loading = read("components/feedback/LoadingState.tsx");
for (const token of [
  "config.loader()", "unwrapClientList(response)", "normalizeClientRecord(item, config.key)",
  "requestId.current", "explainListError(cause)", "error.status === 401",
  "error.status === 403", "error.status >= 500", "loadRecords(false)",
  "ClientEssentialRecords", "setRecords([])"
]) assert.ok(list.includes(token), "Client records safety contract missing: " + token);
assert.match(client, /method === "GET" \? AbortSignal\.timeout\(27000\) : undefined/);
assert.match(proxy, /signal: AbortSignal\.timeout\(20000\)/);
assert.match(list, /if \(!quiet\) setRecords\(\[\]\)/);
assert.match(list, /if \(current === requestId\.current\) setRecords\(apiRecords\)/);
assert.ok(error.includes('role="alert"') && error.includes("border-console-line"));
assert.ok(loading.includes('role="status"') && loading.includes("text-console-primary"));
for(const source of [error, loading]) {
 assert.ok(!source.includes("min-h-[18rem]"),"Old oversized UI returned");
 assert.ok(!source.includes("bg-red-50/70"),"Old red full-panel error returned");
}
if(process.argv.includes("--built")) {
 const folder = path.resolve(__dirname, "../.next/static"), css=[];
 function scan(p){if(!fs.existsSync(p))return;
  for(const entry of fs.readdirSync(p,{withFileTypes:true})){
   const file=path.join(p,entry.name);
   if(entry.isDirectory())scan(file);else if(file.endsWith(".css"))css.push(file);
  }
 }
 scan(folder);
 assert.ok(css.length,"Next emitted CSS missing");
 const compiled=css.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const cls of [".border-console-line",".text-console-primary",".text-console-ink",".bg-white"]) {
   assert.ok(compiled.includes(cls), "Missing Tailwind design utility " + cls);
 }
}
console.log("PASS: Client API error/retry, token states, GET deadlines and accessible Tailwind recovery");
