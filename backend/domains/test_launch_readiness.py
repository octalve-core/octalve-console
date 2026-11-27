"""Read-only launch workbench qualification; no supplier or financial writes."""
from decimal import Decimal
from unittest.mock import Mock, patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.domain_pilot_scope import PILOT
from payments.models import PaymentGateway, PaymentIntent, Transaction, WebhookEvent
from services.models import Service
from providers.cloudflare_int01 import CloudflareINT01Denied
from .models import Domain, TLDPricing
from .launch_readiness import price_review

URL="/api/domains/admin/launch-review/"

class RegistrarLaunchTests(TestCase):
    def setUp(self):
        user=get_user_model()
        self.admin=user.objects.create_superuser(username="launch-super",email="launch-super@example.test",password="fixture-only",email_verified_at=timezone.now())
        self.owner=user.objects.create_user(username="launch-client",email="launch-client@example.test",role="client",email_verified_at=timezone.now())
        self.other=user.objects.create_user(username="launch-other",email="launch-other@example.test",role="client",email_verified_at=timezone.now())
        self.api=APIClient()
        self.api.force_authenticate(self.admin)
        self.rate=TLDPricing.objects.create(tld=".com",status="active",register_price=Decimal("17000"),renewal_price=Decimal("18000"),transfer_price=Decimal("19000"),
            metadata={"published_registrar":{"revision":1},"period_pricing_v1":{"revision":2,"registration":{"1":"20000.00","2":"40000.00"},"renewal":{"1":"21000.00","2":"42000.00"}}})
        self.supplier=Mock()
        self.supplier.check.return_value={"name":"launch-test.com","registrable":True,"tier":"standard","currency":"USD","registration_cost":"10.00","renewal_cost":"12.00"}
        self.payload={"action":"quote","domain":"launch-test.com","confirm_password":"fixture-only","totp_code":"123456"}
    def test_price_drafts_never_override_published(self):
        data=price_review(self.rate)
        self.assertEqual(data["published"]["registration"],"17000")
        self.assertEqual(data["terms"][0]["registration_draft"],"20000.00")
        self.assertEqual(data["published_revision"],1)
        self.assertEqual(data["draft_revision"],2)
        self.assertFalse(data["terms"][1]["term_supported_by_existing_test_checkout"])
        self.assertFalse(data["transfer_executable"])
        self.assertFalse(data["renewal_executable"])
    def test_admin_fresh_quote_cost_arithmetic_and_no_write(self):
        with patch("domains.launch_views.check_mutation"),patch("domains.launch_readiness.registrar",return_value=(self.supplier,{})):
            result=self.api.post(URL,self.payload,format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data["supplier_terms"][-1]["supplier_registration_cost"],"118.00")
        self.assertEqual(result.data["supplier_terms"][-1]["supplier_renewal_cost"],"120.00")
        self.assertFalse(result.data["supplier_terms"][-1]["term_eligibility_verified"])
        self.assertFalse(result.data["checkout_enabled"])
        self.assertFalse(result.data["execution_enabled"])
        self.supplier.check.assert_called_once_with("launch-test.com")
        self.supplier.get_registration.assert_not_called()
        self.supplier.submit_pilot_registration.assert_not_called()
        for model in (Order,Invoice,PaymentIntent,Transaction,Service,Domain):
            self.assertFalse(model.objects.exists())
    def test_client_denied_and_bad_payload_no_provider_call(self):
        self.api.force_authenticate(self.owner)
        with patch("domains.launch_readiness.registrar") as vendor,patch("domains.launch_views.check_mutation"):
            self.assertEqual(self.api.get(URL).status_code,403)
            self.assertEqual(self.api.post(URL,self.payload,format="json").status_code,403)
            self.api.force_authenticate(self.admin)
            self.assertEqual(self.api.post(URL,{**self.payload,"action":"register"},format="json").status_code,400)
            self.assertEqual(self.api.post(URL,{**self.payload,"domain":"evil.test"},format="json").status_code,503)
            self.assertEqual(self.api.post(URL,{**self.payload,"auth_code":"NEVER"},format="json").status_code,400)
            vendor.assert_not_called()
    def test_exact_registration_requires_processed_event_and_pinned_binding(self):
        snapshot={"domain":"launch-test.com","state":"registered","payment_reference":"OC"+"A"*30,"payment_remote_id":"12345","payment_verified_at":timezone.now().isoformat(),"registrar":{"connection":"fixture","version":1}}
        order=Order.objects.create(client=self.owner,status="needs_review",total=Decimal("17000"),subtotal=Decimal("17000"),metadata={PILOT:snapshot})
        OrderItem.objects.create(order=order,product_id=0,plan_id=0,billing_cycle_id=0,item_type="domain",description="Test",domain_name=snapshot["domain"],unit_price=Decimal("17000"),cycle_key="1yr",months=12)
        invoice=Invoice.objects.create(order=order,client=self.owner,status="void",subtotal=order.total,total=order.total,due_date=timezone.now(),metadata={PILOT:True})
        gateway=PaymentGateway.objects.create(code="paystack",name="Test",status="test",test_mode=True)
        intent=PaymentIntent.objects.create(invoice=invoice,client=self.owner,gateway=gateway,reference=snapshot["payment_reference"],status="completed",amount=invoice.total,expires_at=timezone.now())
        event=WebhookEvent.objects.create(gateway=gateway,event_id="fixture:launch",event_type="charge.success",is_verified=True,payload={"intent_id":intent.pk,"reference":intent.reference,"remote_id":"12345"})
        data={**self.payload,"action":"registration","invoice":str(invoice.public_id)}
        self.supplier.get_registration.return_value={"domain_name":snapshot["domain"],"sandbox_status":"active","registered_at":timezone.now().isoformat(),"expires_at":(timezone.now()+timezone.timedelta(days=365)).isoformat()}
        with patch("domains.launch_views.check_mutation"),patch("domains.launch_readiness.pilot_gateway_allowed",return_value=True),patch("domains.launch_readiness.registrar",return_value=(self.supplier,{})) as vendor:
            self.assertEqual(self.api.post(URL,data,format="json").status_code,400)
            vendor.assert_not_called()
            event.is_processed=True
            event.processed_at=timezone.now()
            event.save(update_fields=["is_processed","processed_at"])
            self.assertEqual(self.api.post(URL,{**data,"domain":"different.com"},format="json").status_code,404)
            vendor.assert_not_called()
            result=self.api.post(URL,data,format="json")
            self.assertEqual(result.status_code,200,result.data)
            self.assertEqual(result.data["registration"]["sandbox_status"],"active")
            self.assertEqual(result.data["dns_state"],"no_sandbox_dns_zone")
            vendor.assert_called_once_with(snapshot)
            self.supplier.get_registration.assert_called_once_with(snapshot["domain"])
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT],snapshot)
        self.assertFalse(Domain.objects.exists())
        self.assertFalse(Transaction.objects.exists())
    def test_uuid_renewal_lookup_is_owner_scoped_and_null_safe(self):
        domain=Domain.objects.create(client=self.owner,domain_name="launch-test.com",tld=".com",status="pending",registration_date=None)
        url=f"/api/domains/domains/{domain.public_id}/renewal-status/"
        self.api.force_authenticate(self.other)
        self.assertEqual(self.api.get(url).status_code,404)
        self.api.force_authenticate(self.owner)
        response=self.api.get(url)
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data["state"],"unavailable")
        self.assertIsNone(response.data["expiry_date"])
        self.assertFalse(Invoice.objects.exists())

    def test_supplier_candidate_selection_rejects_unqualified_and_mixed_currency(self):
        from .supplier_catalogue import choose_candidate
        base={"adapter":"cloudflare-registrar","environment":"test","available":True,
              "credential_verified":True,"contract_qualified":True,"terms":[1,2,5],
              "currency":"USD","registration_cost":"9.00","renewal_cost":"11.00"}
        other={**base,"adapter":"resellerclub","registration_cost":"8.00","renewal_cost":"10.00"}
        self.assertEqual(choose_candidate([base,other],years=2)["adapter"],"resellerclub")
        self.assertEqual(choose_candidate([base,{**other,"contract_qualified":False}],years=2)["adapter"],"cloudflare-registrar")
        self.assertIsNone(choose_candidate([base,{**other,"currency":"NGN"}],years=2))
        self.assertIsNone(choose_candidate([base],years=10))
        self.assertIsNone(choose_candidate([{**base,"registration_cost":"NaN"}],years=1))

    def test_catalogue_import_preserves_public_price_and_creates_audit(self):
        from providers.connection_models import IntegrationConnection
        from audit.models import AuditLog
        connection=IntegrationConnection.objects.create(adapter_key="cloudflare-registrar",
            label="Fixture",environment="test",state="draft",current_version=1,
            public_settings={"account_id":"a"*32},created_by=self.admin)
        self.supplier.supported_registration_terms.return_value=[1,2,5]
        with patch("domains.launch_views.check_mutation"),patch(
                "domains.supplier_catalogue.registrar",return_value=(self.supplier,{"connection":str(connection.pk),"version":1})),patch(
                "domains.supplier_catalogue.safe_verification_status",return_value={"verification_status":"verified"}):
            result=self.api.post(URL,{**self.payload,"action":"catalogue"},format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.rate.refresh_from_db()
        self.assertEqual(self.rate.register_price,Decimal("17000"))
        self.assertEqual(self.rate.metadata["sandbox_supplier_catalogue_v1"]["cloudflare-registrar"]["terms"],[1,2,5])
        self.assertTrue(AuditLog.objects.filter(entity_type="TLDPricing",details__retail_prices_changed=False).exists())
        self.assertFalse(Domain.objects.exists())
