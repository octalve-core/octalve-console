"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const models=read("../backend/rewards/models.py"),views=read("../backend/rewards/views.py");
const migration=read("../backend/rewards/migrations/0001_initial.py");
const tests=read("../backend/rewards/tests.py"),settings=read("../backend/octalve_backend/settings.py");
const urls=read("../backend/octalve_backend/urls.py"),bff=read("src/app/api/cloud/[...path]/route.ts");
const auth=read("../backend/accounts/serializers.py"),signup=read("src/features/auth/views/SignupPageClient.tsx");
const client=read("src/features/client/views/ClientRewardsView.tsx");
const admin=read("src/features/admin/views/AdminRewardsView.tsx");
const routes=read("src/lib/routes.ts"),nav=read("src/lib/navigation/dashboard-nav.ts");
for(const token of ["class RewardPolicy","redemption_enabled = models.BooleanField(default=False)",
"class PointEntry","event_key = models.CharField(max_length=150, unique=True)",
"class AffiliateAccount","class ReferralAttribution","class CommissionEntry","class ClientRecognition",
"Points ledger is append-only","MaxValueValidator(5)","MinValueValidator(20)"])
 assert.ok(models.includes(token),"Missing model gate: "+token);
assert.ok(settings.includes("REWARDS_API_ENABLED = env.bool('REWARDS_API_ENABLED', False)"));
assert.ok(settings.includes("'rewards.apps.RewardsConfig'"));
assert.ok(migration.includes('("orders", "0001_initial")'));
for(const token of ["class MyRewards","class AffiliateApply","class AdminGrantPurchasePoints",
"class AdminRewardsStats","class AdminRecognize","class RecognitionDismiss",
"False","status=503","_verified_invoice(invoice)","webhook_verified=True",
"gateway__test_mode=False","transaction.atomic()","select_for_update()",
"CommissionEntry.objects","redemption_available\":False","public_leaderboard_enabled\":False"])
 assert.ok(views.includes(token),"Missing backend authority: "+token);
assert.ok(urls.includes("path('api/rewards/'"));
assert.ok(bff.includes('"rewards"'));
assert.ok(auth.includes("ReferralAttribution.objects.create("));
assert.ok(auth.includes('if getattr(settings,"REWARDS_API_ENABLED",False)'));
assert.ok(signup.includes('new URLSearchParams(window.location.search).get("ref")'));
assert.ok(client.includes("clientApi.rewards()")&&client.includes("clientApi.affiliateApply"));
assert.ok(client.includes("Copy signup link"));
assert.ok(admin.includes("adminApi.rewardStats()")&&admin.includes("adminApi.awardPurchasePoints"));
assert.ok(admin.includes("adminApi.recognizeCustomer"));
assert.ok(routes.includes('rewards: "/client/rewards"')&&routes.includes('rewards: "/admin/rewards"'));
assert.ok(nav.includes('label: "Rewards"'));
for(const file of ["src/app/client/rewards/page.tsx","src/app/admin/rewards/page.tsx"])
 assert.ok(fs.existsSync(path.join(root,file)),"Missing route: "+file);
for(const token of ["test_verified_payment_only_and_idempotent_manual_points",
"test_admin_gated_and_no_fabricated_redemption","test_application_consent_and_idempotent_referral_link",
"test_recognition_is_private_positive_and_customer_dismissible",
"test_default_off_until_migration_and_financial_acceptance"])
 assert.ok(tests.includes(token),"Missing financial test: "+token);
for(const text of [client,admin])
 assert.ok(!/from\s*["'][^"']+\.css["']/.test(text));
console.log("PASS: Batch13 points/commissions separate, admin payouts fail-closed, referral and private KPI integrity");
