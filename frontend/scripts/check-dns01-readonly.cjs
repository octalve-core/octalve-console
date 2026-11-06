/* DNS-01: source and UI guard; real security tests run against Django. */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");
const provider=read("backend/providers/cloudflare_int01.py");
const authority=read("backend/domains/dns_readonly.py");
const view=read("backend/domains/views.py");
const client=read("frontend/src/features/client/views/ClientDomainManagementView.tsx");
const admin=read("frontend/src/features/admin/views/AdminDomainDNSView.tsx");
const endpoints=read("frontend/src/lib/api/endpoints.ts");
const model=read("backend/domains/models.py");
const migration=read("backend/domains/migrations/0002_dns_readonly_binding.py");
for(const s of ["def dns_live_inventory(","name_servers","MAX_DNS_RECORDS","record_digest_sha256"]){
  assert(provider.includes(s), "Missing Cloudflare read-only inventory gate: "+s);
}
for(const s of ["def live_inventory(","def consent(","def approve(","def revoke(",
  "verify_chain(row)","unseal_version(credential)","DomainDNSBinding.State.ACTIVE",
  "spend_durable_auth_attempt","read_only","execution_enabled"]){
  assert(authority.includes(s),"Missing DNS authority: "+s);
}
for(const s of ["dns-prepare","dns-consent","dns-approve","dns-revoke","live-dns"]){
  assert(view.includes(s),"Django route missing: "+s);
}
assert(client.includes("clientApi.domainDnsLive(id)"));
assert(client.includes('liveDns?.state==="connected"'));
assert(!client.includes("domain?.dnsRecords.map("), "Never present stored DNS as live");
assert(client.includes("Approve read-only DNS access"));
assert(client.includes("Revoke DNS access"));
assert(admin.includes("Verify zone and prepare access"));
assert(admin.includes("Approve read-only DNS access"));
assert(endpoints.includes("domainDnsConsent"));
assert(endpoints.includes("domainDnsRevoke"));
assert(model.includes("class DomainDNSBinding"));
assert(migration.includes("migrations.CreateModel"));
assert(!/def (create|update|delete)_dns_record\(/.test(authority));
console.log("DNS-01: read-only tenant, client and Admin source contract passed.");
