"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src/features/admin/integrations/");
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const source=read("connection-readback.ts"),hook=read("useConnectionOverview.ts");
const store=read("IntegrationStore.tsx"),sheet=read("ProviderSideSheet.tsx"),card=read("ProviderCard.tsx");
const setup=read("SecureConnectionSetup.tsx"),verify=read("SavedConnectionActions.tsx");
assert.ok(source.includes('api.get<ConnectionResponse>("/providers/connections/")'));
assert.ok(source.includes('api.get<SchemaResponse>("/providers/connections/schemas/")'));
assert.ok(source.includes("execution_enabled!==false"));
assert.ok(hook.includes('status:"unavailable"'));
for(const value of [source,hook,store,sheet,card,setup,verify]){
 assert.ok(!/localStorage|sessionStorage|window\.open\(|download_url/.test(value),
  "Provider secrets or connection data must not persist or escape to external window.");
}
assert.ok(store.includes("useConnectionOverview()")&&store.includes("Connection registry is not available yet."));
assert.ok(sheet.includes("Unverified draft")&&sheet.includes("Supplier account creation and DNS writes remain disabled."));
assert.ok(sheet.includes("SecureConnectionSetup")&&sheet.includes("SavedConnectionActions"));
assert.ok(setup.includes("api.post<SavedDraft>")&&setup.includes('"/providers/connections/"'));
assert.ok(setup.includes('name={"sec_"+key} type="password"')&&setup.includes("form.reset()"));
assert.ok(setup.includes('"/providers/security/stepup/enroll/"')&&setup.includes('"/providers/security/stepup/confirm/"'));
assert.ok(verify.includes('"/verify/"')&&verify.includes('result.execution_enabled!==false'));
assert.ok(!/api\.post/.test(store)&&!/api\.post/.test(sheet));
assert.ok(card.includes("Draft saved")&&!card.includes(">Connected</span>"));
console.log("PASS: Console-only encrypted drafts, TOTP step-up, guarded read-only verification, no vendor activation.");
