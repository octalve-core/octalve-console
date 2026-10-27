"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=p=>fs.readFileSync(path.join(root,p),"utf8");
const backend=src("../backend/notifications/customer_views.py");
const models=src("../backend/notifications/models.py");
const urls=src("../backend/notifications/urls.py");
const project=src("../backend/octalve_backend/urls.py");
const bff=src("src/app/api/cloud/[...path]/route.ts");
const api=src("src/lib/api/endpoints.ts");
const nav=src("src/lib/navigation/dashboard-nav.ts");
const header=src("src/components/layout/DashboardHeader.tsx");
const dash=src("src/features/client/views/ClientDashboardView.tsx");
const alerts=src("src/features/client/components/ClientLoginAlerts.tsx");
const inbox=src("src/features/client/components/ClientNoticeInbox.tsx");
const prefs=src("src/features/client/components/ClientNoticePreferences.tsx");
const community=src("src/features/client/views/ClientCommunityView.tsx");
const routes=src("src/lib/routes.ts");
const tests=src("../backend/notifications/tests.py");
const checks={
 backend:["client=user","_client(request)","metadata","select_for_update()",
  "invoice_start","domain_start","amount_due__gt=0","expiry_date__lte=domain_end",
  'stage = "overdue"','stage = "expired"',"MAX_READ_KEYS",
  'email_reminders_enabled": False',"_safe_community_link",
  'group__key="general"',"is_public=True","is_encrypted=False"],
 api:["notices()","markNoticeRead(key:string)","noticePreferences()",
  "updateNoticePreferences(prefs:Partial<CustomerNoticePreferences>)","community()"],
 inbox:["clientApi.notices()","clientApi.markNoticeRead(item.key)","unread_count",
  "Mark read","View invoice","Review domain","No unread reminders"],
 prefs:["clientApi.noticePreferences()","clientApi.updateNoticePreferences(draft)",
  "show_login_alerts","invoice_alerts","domain_alerts"],
 community:["clientApi.community()","rel=\"noopener noreferrer\"",
  "Coming soon","automatically","Joining"],
};
for(const [key,needles] of Object.entries(checks)){
 const source={backend,api,inbox,prefs,community}[key];
 for(const token of needles)assert.ok(source.includes(token),key+" missing "+token);
}
assert.ok(!models.includes("CustomerNotification"),"Do not invent an un-migrated model");
assert.ok(urls.includes("inbox/")&&urls.includes("preferences/")&&urls.includes("community/"));
assert.ok(project.includes("path('api/notifications/'"));
assert.ok(bff.includes('"notifications"'));
assert.ok(nav.includes('label: "Notifications"')&&nav.includes('label: "O-Cloud Clan"'));
assert.ok(routes.includes('notifications: "/client/notifications"'));
assert.ok(routes.includes('community: "/client/community"'));
assert.ok(header.includes('href="/client/notifications"')&&header.includes('role==="client"'));
assert.ok(dash.includes("<ClientLoginAlerts/>")&&alerts.includes("show_login_alerts"));
assert.ok(src("src/app/client/settings/page.tsx").includes("<ClientNoticePreferences/>"));
for(const route of ["src/app/client/community/page.tsx","src/app/client/notifications/page.tsx"])
 assert.ok(fs.existsSync(path.join(root,route)));
for(const needle of ["test_inbox_realtime_scoped_and_no_financial_side_effects",
 "test_mark_read_is_atomic_scoped_and_idempotent",
 "test_other_tenant_cannot_read_or_write_another_account",
 "test_unapproved_community_links_are_not_published"])
 assert.ok(tests.includes(needle));
for(const source of [inbox,prefs,alerts,community])
 assert.ok(!/from\s*["'][^"']+\.css["']/.test(source));
console.log("PASS: Batch12 authenticated due reminders, tenant-scoped read state, UI preferences and opt-in community");
