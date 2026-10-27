"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src/features/admin/integrations/");
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const source=read("connection-readback.ts"),hook=read("useConnectionOverview.ts");
const store=read("IntegrationStore.tsx"),sheet=read("ProviderSideSheet.tsx"),card=read("ProviderCard.tsx");
assert.ok(source.includes('api.get<ConnectionResponse>("/providers/connections/")'));
assert.ok(source.includes('api.get<SchemaResponse>("/providers/connections/schemas/")'));
assert.ok(source.includes("execution_enabled!==false"));
assert.ok(hook.includes("status:\"unavailable\""));
for(const value of [source,hook,store,sheet,card]){
 assert.ok(!/api\.post|api\.patch|api\.put|localStorage|sessionStorage|type="password"/.test(value),"Unqualified secret submission introduced");
}
assert.ok(store.includes("useConnectionOverview()")&&store.includes("Connection registry is not available yet."));
assert.ok(sheet.includes("Unverified draft")&&sheet.includes("No supplier activity is enabled."));
assert.ok(card.includes("Draft saved")&&!card.includes(">Connected</span>"));
console.log("PASS: read-only B1 status in the Admin vendor side sheet; no credential entry or supplier execution.");
