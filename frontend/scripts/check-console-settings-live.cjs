"use strict";
/** SET-01–06: ensure live route wiring without treating provider readiness as certification. */
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const view=read("features/admin/settings/views/AdminSettingsSectionView.tsx");
for(const ref of ["ConsolePolicyEditor","ConsoleTaxEditor","MailTemplateWorkbench",
 "OperationalSettingsStatus","section===\"tax\"","section===\"notifications\""]){
 assert.ok(view.includes(ref),"Missing genuine Settings section: "+ref);
}
const policy=read("features/admin/settings/components/ConsolePolicyEditor.tsx");
assert.ok(policy.includes("api.get<Snapshot>")&&policy.includes("api.patch<Snapshot>"),"Settings must read/save through Django");
assert.ok(policy.includes("revision:snapshot.revision")&&policy.includes("changes:"),"Settings requires exact optimistic-locking patch");
assert.ok(!policy.includes("localStorage"),"Global policy must never be browser-local");
const tax=read("features/admin/settings/components/ConsoleTaxEditor.tsx");
assert.ok(tax.includes("api.patch<Tax>")&&tax.includes("checkout not connected"),"Tax must show saved state, not false checkout activation");
const mail=read("features/admin/settings/components/MailTemplateWorkbench.tsx");
for(const token of ["console-mail/templates/","console-mail/outbox/","/history/","/preview/","/duplicate/","saving?"]){
 assert.ok(mail.includes(token),"Missing real mail API or state: "+token);
}
assert.ok(!mail.includes("dangerouslySetInnerHTML"),"Unsafe template preview");
const auth=read("features/auth/components/AuthFormControls.tsx");
assert.ok(auth.includes("export function AuthSocialOptions")&&auth.includes("return null;"),"Uncertified OAuth controls must be hidden");
const shell=read("components/layout/DashboardShell.tsx");
assert.ok(shell.includes("<ConsoleThemeSync/>"),"Shared operator theme token subscription missing");
const sync=read("features/shell/components/ConsoleThemeSync.tsx");
assert.ok(sync.includes("allowedPrimary")&&sync.includes("allowedCanvas"),"Theme tokens must be verified before CSS injection");
const endpoints=read("features/admin/settings/components/OperationalSettingsStatus.tsx");
assert.ok(endpoints.includes("console-status/")&&!endpoints.includes("api_key="),"Integration status must be read-only without credentials");
console.log("PASS: real settings APIs, audit revisions, outbox, tax disclaimers, safe OAuth and theme");
