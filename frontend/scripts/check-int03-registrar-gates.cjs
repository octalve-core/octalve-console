"use strict";
// Static cross-stack fail-closed contract. Runtime authorization lives in Django.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const view=read("backend/providers/connection_registrar_views.py");
const transport=read("backend/providers/cloudflare_int01.py");
const settings=read("backend/octalve_backend/settings.py");
const urls=read("backend/providers/urls.py");
const domains=read("backend/domains/views.py");
const quote=read("frontend/src/features/admin/integrations/RegistrarQuotePanel.tsx");
const sheet=read("frontend/src/features/admin/integrations/ProviderSideSheet.tsx");
const catalog=read("frontend/src/features/admin/integrations/catalog/domains.ts");
const adapter=read("backend/apps/providers/adapters/domain_registrar.py");
assert.ok(settings.includes('CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED = env.bool(') &&
 settings.includes('default=False'));
assert.ok(view.includes('["POST"]') && view.includes("check_mutation(") &&
 view.includes("verify_chain(") && view.includes("unseal_version(") &&
 view.includes("AuditLog.objects.create(") && view.includes('"checkout_enabled": False') &&
 view.includes('"registration_enabled": False') &&
 view.includes('"execution_enabled": False'));
assert.ok(urls.includes("/registrar-quote/"));
assert.ok(transport.includes('f"/accounts/{self.account_id}/registrar/domain-check"') &&
 !transport.includes('f"/accounts/{self.account_id}/registrar/registrations"') &&
 transport.includes('MAX_DNS_RECORDS = 1000') &&
 transport.includes('f"/zones/{zone_id}/dns_records?page={page}&per_page={DNS_PAGE_SIZE}"'));
assert.ok(quote.includes('type="password"') && quote.includes('name="totp_code"') &&
 quote.includes("response.registration_enabled!==false") &&
 quote.includes('supplier costs, not Octalve sale prices') &&
 !/localStorage|sessionStorage|window\.open|NEXT_PUBLIC_/.test(quote));
assert.ok(sheet.includes('item.slug==="cloudflare-registrar-live"') &&
 catalog.includes('"slug": "cloudflare-registrar-live"'));
assert.ok(!/AdapterResult\(ok=True/.test(adapter));
for(const phrase of ["Live registrar availability and pricing","Domain registration","DNS record creation"]){
 assert.ok(domains.includes(phrase),"Preserve fail-closed customer operation: "+phrase);
}
console.log("PASS: INT-03 live price checks are MFA-gated and read-only; domain billing, DNS writes and registration remain disabled.");
