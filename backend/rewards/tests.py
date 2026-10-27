from decimal import Decimal
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from billing.models import Invoice
from payments.models import PaymentGateway,Transaction
from .models import RewardPolicy,RewardTier,PointEntry,AffiliateAccount,ReferralAttribution,ClientRecognition

User=get_user_model()

@override_settings(REWARDS_API_ENABLED=True)
class RewardsBatch13Tests(APITestCase):
    def setUp(self):
        self.admin=User.objects.create_superuser(
            email="reward-admin@example.invalid",username="reward_admin",
            password="SyntheticOnly--2026!"
        )
        self.owner=User.objects.create_user(
            email="reward-owner@example.invalid",username="reward_owner",
            password="SyntheticOnly--2026!"
        )
        self.other=User.objects.create_user(
            email="reward-other@example.invalid",username="reward_other",
            password="SyntheticOnly--2026!"
        )
        self.invoice=Invoice.objects.create(
            client=self.owner,total=Decimal("12000.00"),
            subtotal=Decimal("12000.00"),currency="NGN",
            due_date=timezone.now()+timedelta(days=7)
        )
        self.client.force_authenticate(user=self.owner)

    def test_application_consent_and_idempotent_referral_link(self):
        self.assertEqual(self.client.get("/api/rewards/me/").data["affiliate"]["status"],"not_applied")
        self.assertEqual(self.client.post("/api/rewards/affiliate/apply/",{
            "accept_terms":False,"terms_version":"ocloud-affiliate-2026-10"},format="json").status_code,400)
        for iteration in range(2):
            r=self.client.post("/api/rewards/affiliate/apply/",{
                "accept_terms":True,"terms_version":"ocloud-affiliate-2026-10"},format="json")
            self.assertEqual(r.status_code,201 if iteration==0 else 200)
            self.assertEqual(r.data["status"],"pending")
            self.assertEqual(r.data["referral_code"],self.owner.referral_code)
        self.assertEqual(AffiliateAccount.objects.filter(user=self.owner).count(),1)
        self.assertEqual(PointEntry.objects.count(),0)

    def test_signup_attribution_is_one_customer_once_no_points_or_commission(self):
        self.client.post("/api/rewards/affiliate/apply/",{
            "accept_terms":True,"terms_version":"ocloud-affiliate-2026-10"},format="json")
        from accounts.serializers import CustomUserCreateSerializer
        payload={"full_name":"New Client","email":"new-client@example.invalid","username":"client_link",
                 "password":"Strong-CI-pass-4214-Z!","re_password":"Strong-CI-pass-4214-Z!",
                 "referral_code":self.owner.referral_code}
        serializer=CustomUserCreateSerializer(data=payload)
        self.assertTrue(serializer.is_valid(),serializer.errors)
        referred=serializer.save()
        self.assertEqual(ReferralAttribution.objects.get(referred_user=referred).referrer_id,self.owner.pk)
        self.assertEqual(PointEntry.objects.count(),0)
        self.assertEqual(self.client.get("/api/rewards/me/").data["affiliate"]["attributed_signups"],1)

    def test_admin_gated_and_no_fabricated_redemption(self):
        self.assertEqual(self.client.get("/api/rewards/admin/stats/").status_code,404)
        self.assertEqual(self.client.post("/api/rewards/admin/purchases/award/",{
            "invoice_id":self.invoice.pk},format="json").status_code,404)
        policy=RewardPolicy.objects.create(is_active=True,min_eligible_points=5)
        RewardTier.objects.create(policy=policy,title="Thank-you offer",
            required_points=5,discount_percent=Decimal("5"),max_discount_ngn=Decimal("2500"),enabled=True)
        PointEntry.objects.create(user=self.owner,event_key="test-award-once",kind="adjustment",points_delta=10)
        data=self.client.get("/api/rewards/me/").data
        self.assertEqual(data["points"]["balance"],10)
        self.assertEqual(data["points"]["redeemable_cash"],"0.00")
        self.assertEqual(Decimal(data["offer"]["discount_percent"]),Decimal("5.00"))
        self.assertFalse(data["offer"]["redemption_available"])

    def test_verified_payment_only_and_idempotent_manual_points(self):
        RewardPolicy.objects.create(is_active=True,points_per_ngn=1000)
        self.client.force_authenticate(user=self.admin)
        url="/api/rewards/admin/purchases/award/"
        self.assertEqual(self.client.post(url,{"invoice_id":self.invoice.pk},format="json").status_code,409)
        self.invoice.status="paid";self.invoice.save(update_fields=["status"])
        self.assertEqual(self.client.post(url,{"invoice_id":self.invoice.pk},format="json").status_code,409)
        gateway=PaymentGateway.objects.create(code="paystack",name="Test Fixture",status="active",test_mode=False)
        txn=Transaction.objects.create(
            client=self.owner,invoice=self.invoice,gateway=gateway,
            reference="test-verified-award",amount=Decimal("12000.00"),
            net_amount=Decimal("12000.00"),currency="NGN",status="successful",
            webhook_verified=True,transaction_type="payment",
        )
        first=self.client.post(url,{"invoice_id":self.invoice.pk},format="json")
        self.assertEqual(first.status_code,201,first.data)
        self.assertEqual(first.data["points"],12)
        second=self.client.post(url,{"invoice_id":self.invoice.pk},format="json")
        self.assertEqual(second.status_code,200,second.data)
        self.assertTrue(second.data["already_recorded"])
        self.assertEqual(PointEntry.objects.filter(user=self.owner).count(),1)
        self.assertEqual(self.invoice.status,"paid")
        self.assertEqual(Transaction.objects.get(pk=txn.pk).status,"successful")

    def test_recognition_is_private_positive_and_customer_dismissible(self):
        self.client.force_authenticate(user=self.admin)
        r=self.client.post("/api/rewards/admin/recognitions/",{
            "client_id":self.owner.pk,"title":"Thank you for growing with us",
            "message":"Your continued support means a great deal to our community."
        },format="json")
        self.assertEqual(r.status_code,201,r.data)
        self.assertTrue(ClientRecognition.objects.get(pk=r.data["id"]).published)
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get("/api/rewards/me/").data["recognition"],[])
        self.assertEqual(self.client.post(
            f"/api/rewards/recognitions/{r.data['id']}/dismiss/",{},format="json").status_code,404)
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(len(self.client.get("/api/rewards/me/").data["recognition"]),1)
        self.assertEqual(self.client.post(
            f"/api/rewards/recognitions/{r.data['id']}/dismiss/",{},format="json").status_code,200)
        self.assertEqual(self.client.get("/api/rewards/me/").data["recognition"],[])

    def test_admin_approval_and_kpi_are_private(self):
        account=AffiliateAccount.objects.create(user=self.owner,terms_version="ocloud-affiliate-2026-10")
        self.client.force_authenticate(user=self.admin)
        response=self.client.post(f"/api/rewards/admin/affiliates/{account.pk}/review/",{
            "decision":"approve"},format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data["status"],"approved")
        stats=self.client.get("/api/rewards/admin/stats/").data
        self.assertEqual(stats["affiliates_approved"],1)
        self.assertFalse(stats["public_leaderboard_enabled"])
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.get("/api/rewards/admin/affiliates/").status_code,404)

    def test_append_only_points(self):
        entry=PointEntry.objects.create(user=self.owner,event_key="never-change",points_delta=12,kind="adjustment")
        entry.points_delta=900
        with self.assertRaises(ValueError):
            entry.save()

    @override_settings(REWARDS_API_ENABLED=False)
    def test_default_off_until_migration_and_financial_acceptance(self):
        self.assertEqual(self.client.get("/api/rewards/me/").status_code,503)
        self.assertEqual(AffiliateAccount.objects.count(),0)
