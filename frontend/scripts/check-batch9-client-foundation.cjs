"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const base=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(base,relative),"utf8");
const nav=read("src/lib/navigation/dashboard-nav.ts");
const groups=read("src/features/shell/components/ConsoleNavigationGroup.tsx");
const dynamic=read("src/features/shell/components/ClientCatalogNavigation.tsx");
const routes=read("src/lib/routes.ts");
const api=read("src/lib/api/endpoints.ts");
const bff=read("src/app/api/cloud/[...path]/route.ts");
const backend=read("../backend/catalog/public_storefront.py");
const urls=read("../backend/catalog/public_urls.py");
const caseTests=read("../backend/catalog/test_public_storefront.py");
const table=read("src/components/data/CloudRecordDirectory.tsx");
const essential=read("src/features/client/components/ClientEssentialRecords.tsx");
const order=read("src/features/client/views/ClientOrderView.tsx");
const checkout=read("src/features/client/data/client-order-data.ts");
for(const t of ['label: "Purchases"','label: "Settings"','routes.client.purchases','routes.client.settings'])
 assert.ok(nav.includes(t),"Missing approved client navigation: "+t);
const client=nav.slice(nav.indexOf("export const clientNavGroups:"),nav.indexOf("export const staffNavGroups:"));
for(const bad of ['label: "Language"','label: "Billing"','label: "Invoice & Orders"','label: "VPS Hosting"','label: "WordPress Hosting"'])
 assert.ok(!client.includes(bad),"Hardcoded or excluded client sidebar item: "+bad);
assert.ok(routes.includes('purchases: "/client/purchases"'));
assert.ok(routes.includes('settings: "/client/settings"'));
assert.ok(fs.existsSync(path.join(base,"src/app/client/settings/page.tsx")));
assert.ok(fs.existsSync(path.join(base,"src/app/client/purchases/page.tsx")));
// Settings language control moved into the reviewed owner-scoped component in Batch 14.
const settingsPage=read("src/app/client/settings/page.tsx");
const languagePanel=read("src/features/client/components/ClientLanguagePreferences.tsx");
const localeClient=read("src/lib/i18n/preferences.ts");
const languageBackend=read("../backend/accounts/language_preferences.py");
assert.ok(settingsPage.includes("<ClientLanguagePreferences/>"),"Language preference panel missing");
const localeProvider=read("src/lib/i18n/LocaleProvider.tsx");
assert.ok(localeProvider.includes("languagePreferenceApi.get()"),"Language preference must be server-backed");
assert.ok(localeProvider.includes("languagePreferenceApi.save(language)"),"Language save must be explicit");
assert.ok(languagePanel.includes("changeLanguage(chosen)"),"Language selection must be server-confirmed");
assert.ok(localeClient.includes('"/auth/language/"'),"Missing protected language route");
assert.ok(languageBackend.includes("permission_classes = [IsAuthenticated]"),"Language preference must be authenticated");
assert.ok(languageBackend.includes('CLOUD_MULTILINGUAL_ENABLED'),"Language availability must be gated");
assert.ok(dynamic.includes("publicApi.publishedCategories()"));
assert.ok(dynamic.includes("categories.map(item=>"));
assert.ok(dynamic.includes("encodeURIComponent(item.slug)"));
assert.ok(!dynamic.includes("VPS Hosting")&&!dynamic.includes("WordPress Hosting"));
assert.ok(groups.includes("ClientServicesNavigation")&&groups.includes("ClientDomainsNavigation"));
assert.ok(api.includes('categories: "/storefront/categories/"'));
assert.ok(bff.includes('"storefront"')&&bff.includes('apiPath === "storefront/categories" && method === "GET"'));
for(const token of ["class PublicPublishedCategories","products__plans__published_versions__isnull=False",
 "products__plans__billing_cycles__is_active=True","products__is_public=True",
 'permission_classes = [AllowAny]'])assert.ok(backend.includes(token));
assert.ok(urls.includes('path("categories/", PublicPublishedCategories.as_view()'));
assert.ok(caseTests.includes("test_categories_require_published_priced_active_offers"));
assert.ok(essential.includes("CloudRecordDirectory")&&essential.includes("onOpen={openDetails}"));
assert.ok(essential.includes("records.find(item=>item.id===row.id)"));
assert.ok(table.includes("lg:hidden")&&table.includes("lg:block"));
assert.ok(table.includes("aria-modal=\"true\""));
for(const part of ["focusable()","event.key===\"Escape\"","event.key!==\"Tab\"",
 "focusOrigin.current","document.body.style.overflow","ref={dialogRef}"])
 assert.ok(table.includes(part),"Modal accessibility missing: "+part);
assert.ok(order.includes("categorySlug")&&order.includes("visiblePlans"));
assert.ok(checkout.includes('["shared_hosting", "wordpress_hosting", "vps"].includes(p.product_type)'));
for(const file of ["src/features/shell/components/ClientCatalogNavigation.tsx",
 "src/components/data/CloudRecordDirectory.tsx",
 "src/features/client/components/ClientEssentialRecords.tsx"]) {
 const source=read(file);
 assert.ok(!/from\s*["'][^"']+\.css["']/.test(source),"Legacy CSS import "+file);
}
if(process.argv.includes("--built")){
 const folder=path.join(base,".next/static"),css=[];
 function visit(dir){if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const file=path.join(dir,entry.name);
   if(entry.isDirectory())visit(file);else if(file.endsWith(".css"))css.push(file);
  }
 }
 visit(folder);
 assert.ok(css.length,"No Next compiled CSS");
 const full=css.map(file=>fs.readFileSync(file,"utf8")).join("\n");
 for(const className of [".text-console-primary",".border-console-line",".bg-console-primary"])
  assert.ok(full.includes(className),"Missing emitted Tailwind utility "+className);
}
console.log("PASS: Batch 9 dynamic published catalogue navigation, Purchases/Settings, canonical responsive table, modal focus and checkout authority");
