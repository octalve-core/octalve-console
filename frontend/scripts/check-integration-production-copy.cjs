"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src/features/admin/integrations");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const groups=["hosting","services","domains","email","cloud"];
const content=groups.map(p=>read("catalog/"+p+".ts")).join("\n");
const slugs=[...content.matchAll(/"slug": "([^"]+)"/g)].map(x=>x[1]);
assert.equal(slugs.length,24);
assert.equal(new Set(slugs).size,24);
for(const x of ["INT-01","INT-02","backend secret storage","source-tested","versioned adapter","readback","credential draft schema","backend-only","int01_cloudflare_probe"]){
 assert.ok(!content.includes(x),"Technical development language leaked into provider copy: "+x);
}
const store=read("IntegrationStore.tsx"),sheet=read("ProviderSideSheet.tsx"),
  form=read("SecureConnectionSetup.tsx"),requirement=read("ProviderRequirements.tsx");
assert.ok(store.includes("Connect and manage your hosting")&&
 store.includes("3. Confirm access"));
assert.ok(sheet.includes("Connect {item.name}")&&
 sheet.includes("Saving a connection does not change"));
assert.ok(requirement.includes("What you need</h3>")&&
 requirement.includes("Available services and restrictions</h3>"));
assert.ok(form.includes('cloudflareHelp')&&
 form.includes('Zone Read and DNS Read')&&
 form.includes('Cloudflare → Select your domain → Overview → API → Zone ID.')&&
 form.includes('item.slug==="cloudflare-dns"?"live":"test"')&&
 form.includes('name={"sec_"+key} type="password"')&&
 form.includes('name="totp_code"')&&
 form.includes('api.post<SavedDraft>("/providers/connections/",payload)'));
assert.ok(!/localStorage|sessionStorage|NEXT_PUBLIC_/.test(form));
console.log("PASS: all 24 provider summaries are clear, real Cloudflare IDs are explained, and existing credential protections remain intact.");
