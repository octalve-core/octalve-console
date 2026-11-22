"""TLD term-rate draft authority: synthetic Django data, no vendor writes."""
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from audit.models import AuditLog
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_registrar_views import TLD_SUPPLIER_QUOTE_SALT
from .models import TLDPricing

URL="/api/domains/admin/tld-price-cards/"
PASSWORD="synthetic-super-admin-only-2026"

def payload(**changes):
    row={
        "tld":".com.ng", "description":"Synthetic rates, not a registrar quote",
        "registration":{"1":"15000.00","2":"28500.00","5":"69000.00","10":"129000.00"},
        "renewal":{"1":"17000.00","2":"33000.00","5":"81000.00","10":"159000.00"},
        "transfer_price":"18000.00",
        "expected_revision":0,"confirm_password":PASSWORD,"totp_code":"123456",
    }
    row.update(changes)
    return row

class TLDPriceSettingsTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.owner=User.objects.create_superuser(
            username="rate_super",email="rate-super@example.invalid",
            password=PASSWORD,email_verified_at=timezone.now())
        self.client_user=User.objects.create_user(
            username="rate_client",email="rate-client@example.invalid",
            password=PASSWORD,role="client")
        self.staff=User.objects.create_user(
            username="rate_staff",email="rate-staff@example.invalid",
            password=PASSWORD,role="staff",is_staff=True)
        self.client=APIClient()
        self.client.force_authenticate(user=self.owner)
        self.mfa_patch=patch("domains.tld_pricing_admin.check_mutation",return_value=None)
        self.mfa_patch.start()
        self.addCleanup(self.mfa_patch.stop)

    def test_publish_markup_and_unpublish_one_route(self):
        self.assertEqual(self.client.post(URL, payload(tld=".com"), format="json").status_code, 200)
        connection = IntegrationConnection.objects.create(
            adapter_key="cloudflare-registrar-live", label="Supplier", environment="live",
            state="draft", current_version=1, created_by=self.owner,
        )
        IntegrationCredentialVersion.objects.create(connection=connection, version=1, key_id="v1", ciphertext="synthetic")
        quote = signing.dumps({
            "actor_id": str(self.owner.pk), "connection_id": str(connection.pk), "credential_version": 1,
            "tld": ".com", "currency": "USD", "registration_cost": "10.00", "renewal_cost": "12.00",
        }, salt=TLD_SUPPLIER_QUOTE_SALT)
        body = {"action": "publish", "tld": ".com", "expected_revision": 1,
                "confirm_password": PASSWORD, "totp_code": "123456", "supplier_quote": quote,
                "ngn_per_supplier_unit": "1500.00", "pricing_mode": "markup",
                "registration": "20.00", "renewal": "25.00"}
        response = self.client.post(URL + "publication/", body, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row = TLDPricing.objects.get(tld=".com")
        self.assertEqual((row.status, row.register_price, row.renewal_price),
                         ("active", Decimal("18000.00"), Decimal("22500.00")))
        self.assertEqual(row.metadata["published_registrar"]["connection_id"], str(connection.pk))
        self.assertEqual(self.client.post(URL + "publication/", body, format="json").status_code, 409)
        response = self.client.post(URL + "publication/", {
            "action": "unpublish", "tld": ".com", "expected_revision": 2,
            "confirm_password": PASSWORD, "totp_code": "123456",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertEqual(row.status, "inactive")
        self.assertNotIn("published_registrar", row.metadata)

    def test_super_admin_may_save_valid_versioned_prices_without_publication(self):
        res=self.client.post(URL,payload(),format="json")
        self.assertEqual(res.status_code,200,res.data)
        self.assertEqual(res.data["revision"],1)
        self.assertFalse(res.data["checkout_enabled"])
        self.assertFalse(res.data["registrar_quote_verified"])
        row=TLDPricing.objects.get(tld=".com.ng")
        self.assertEqual(row.status,"inactive")
        self.assertEqual(row.register_price,Decimal("15000.00"))
        self.assertEqual(row.renewal_price,Decimal("17000.00"))
        self.assertEqual(row.metadata["period_pricing_v1"]["registration"]["5"],"69000.00")
        self.assertEqual(row.metadata["period_pricing_v1"]["renewal"]["10"],"159000.00")
        self.assertFalse(TLDPricing.objects.filter(status="active").exists())
        public=self.client.get("/api/domains/tld-pricing/")
        self.assertEqual(public.status_code,200)
        self.assertEqual(len(public.data),0)
        self.assertEqual(AuditLog.objects.filter(entity_type="TLDPricing").count(),2)
        edited=self.client.post(URL,payload(expected_revision=1,
            registration={"1":"15500.00","2":"30000.00","5":"70000.00","10":"135000.00"}),format="json")
        self.assertEqual(edited.status_code,200,edited.data)
        self.assertEqual(edited.data["revision"],2)
        self.assertEqual(TLDPricing.objects.count(),1)

    def test_stale_revision_and_invalid_periods_do_not_mutate_or_audit(self):
        self.assertEqual(self.client.post(URL,payload(),format="json").status_code,200)
        before=TLDPricing.objects.get(tld=".com.ng").metadata
        stale=self.client.post(URL,payload(expected_revision=0),format="json")
        self.assertEqual(stale.status_code,409)
        for sample in (
            payload(tld=".COM"),
            payload(tld=".co..uk"),
            payload(registration={"1":"15000.00","5":"69000.00"}),
            payload(registration={"1":"15000.00","2":"10000.00","5":"69000.00","10":"129000.00"}),
            payload(renewal={"1":"0.00","2":None,"5":None,"10":None}),
            payload(renewal={"1":"17000.00","2":None,"5":None,"10":None},transfer_price="-10.00"),
            payload(confirm_password="incorrect-password"),
            payload(extra_field=True),
        ):
            with self.subTest(sample=str(sample)[:80]):
                result=self.client.post(URL,sample,format="json")
                self.assertIn(result.status_code,(400,403),result.data)
        row=TLDPricing.objects.get(tld=".com.ng")
        self.assertEqual(row.metadata,before)
        self.assertEqual(AuditLog.objects.filter(entity_type="TLDPricing").count(),2)

    def test_no_client_staff_ordinary_admin_or_unverified_super_admin_can_read_or_edit(self):
        ordinary=get_user_model().objects.create_user(
            username="rate_ordinary",email="rate-ordinary@example.invalid",
            role="admin",password=PASSWORD,is_staff=True)
        unverified=get_user_model().objects.create_superuser(
            username="rate_unverified",email="rate-unverified@example.invalid",password=PASSWORD)
        for actor in (self.client_user,self.staff,ordinary,unverified):
            self.client.force_authenticate(user=actor)
            with self.subTest(role=actor.role):
                self.assertEqual(self.client.get(URL).status_code,403)
                self.assertEqual(self.client.post(URL,payload(),format="json").status_code,403)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(URL).status_code,(401,403))
        self.assertFalse(TLDPricing.objects.exists())

    def test_explicit_absent_10year_term_stays_unavailable_and_nothing_is_charged(self):
        optional={"1":"23000.00","2":None,"5":None,"10":None}
        res=self.client.post(URL,payload(tld=".org",
            registration=optional,renewal=optional),format="json")
        self.assertEqual(res.status_code,200,res.data)
        self.assertIsNone(res.data["registration"]["10"])
        from payments.models import PaymentIntent
        from orders.models import Order
        self.assertEqual(PaymentIntent.objects.count(),0)
        self.assertEqual(Order.objects.count(),0)


    def test_draft_does_not_replace_public_rates(self):
        TLDPricing.objects.create(tld=".com.ng", status="active", description="Published",
                                  register_price=10000, renewal_price=11000, transfer_price=12000)
        saved = self.client.post(URL, payload(), format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["registration"]["1"], "15000.00")
        self.assertEqual(saved.data["transfer_price"], "18000.00")
        row = TLDPricing.objects.get(tld=".com.ng")
        self.assertEqual(row.status, "active")
        self.assertEqual(row.description, "Published")
        self.assertEqual(row.register_price, Decimal("10000"))
        self.assertEqual(row.renewal_price, Decimal("11000"))
        self.assertEqual(row.transfer_price, Decimal("12000"))
