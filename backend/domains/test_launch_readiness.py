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

    def test_live_registrar_contact_validation_uses_verified_account_email(self):
        from .live_registration import validate_contact,RegistrationRefused
        contact={"name":"Synthetic Registrant","phone":"+234.8012345678","street":"Fixture Road",
            "city":"Abuja","state":"FCT","country_code":"NG","postal_code":"900001"}
        result=validate_contact(self.admin,contact)
        self.assertEqual(result["email"],self.admin.email)
        self.assertEqual(result["postal_info"]["address"]["country_code"],"NG")
        with self.assertRaises(RegistrationRefused):
            validate_contact(self.admin,{**contact,"email":"other@example.test"})

    def test_live_registration_paid_fence_and_readback(self):
        from . import live_registration as live
        from providers.connection_models import IntegrationConnection
        from payments.readback import ConfirmedGatewayPayment
        from payments.live_reconciliation import consume
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta
        route={"connection_id":"00000000-0000-4000-8000-000000000001","credential_version":1,"revision":1}
        cost={"revision":1,"currency":"USD","registration_cost":"10.00","renewal_cost":"12.00","ngn_per_unit":"1500"}
        self.rate.metadata={**self.rate.metadata,"published_registrar":route,"published_registrar_cost_v1":cost}
        self.rate.save(update_fields=["metadata"])
        row=IntegrationConnection.objects.create(pk=route["connection_id"],adapter_key="cloudflare-registrar-live",
            state="draft",environment="live",label="Fixture",public_settings={"account_id":"a"*32})
        self.supplier.live_domain_check.return_value={"name":"launch-test.com","registrable":True,"currency":"USD","registration_cost":"10.00"}
        contact={"name":"Synthetic Registrant","phone":"+234.8012345678","street":"Fixture Road",
            "city":"Abuja","state":"FCT","country_code":"NG","postal_code":"900001"}
        gateway=PaymentGateway.objects.create(code="paystack",name="Live fixture",status="active",test_mode=False,config={"fixture":1})
        with patch("domains.live_registration.enabled",return_value=True),patch("domains.live_registration.resolve_live_key",return_value="fixture"),patch("domains.live_registration.connector",return_value=(row,"fixture",self.supplier)),patch("domains.live_registration.load",return_value=(row,"fixture")),patch("domains.live_registration.registrar_request") as vendor:
            quoted=live.quote(self.owner,"launch-test.com")
            accepted=live.accept(self.owner,quoted["quote"],contact)
            self.assertEqual(live.accept(self.owner,quoted["quote"],contact),accepted)
            domain=Domain.objects.get(domain_name="launch-test.com")
            self.assertFalse(domain.is_active)
            self.assertEqual(live.transition(domain.pk),"held")
            vendor.assert_not_called()
            invoice=Invoice.objects.get(pk=accepted["invoice_id"])
            intent=PaymentIntent.objects.create(invoice=invoice,client=self.owner,gateway=gateway,
                reference="LIVE_DOMAIN_FIXTURE",status="pending",amount=invoice.total,currency="NGN",
                expires_at=timezone.now()+timedelta(minutes=10),metadata={"payment_mode":"live","gateway_binding":gateway.config})
            event=WebhookEvent.objects.create(gateway=gateway,event_id="live-domain-fixture",event_type="charge.success",is_verified=True,
                payload={"mode":"live","binding":gateway.config,"intent_id":intent.pk,"reference":intent.reference,"remote_id":"12345"})
            with patch("payments.live_reconciliation.enabled",return_value=True),patch("payments.live_reconciliation.resolve_live_key",return_value="fixture"),patch("payments.live_binding.resolve_live_key",return_value="fixture"),patch("payments.settlement.verify_gateway_intent",return_value=ConfirmedGatewayPayment("paystack",intent.reference,"NGN",intent.amount,"12345")),self.settings(CLOUD_SETTLEMENT_COMMIT_ENABLED=True):
                self.assertEqual(consume(event.pk),"processed")
            now=timezone.now()
            self.supplier.live_registration_readback.return_value={"domain_name":domain.domain_name,"status":"active",
                "registered_at":now.isoformat(),"expires_at":(now+relativedelta(years=1)).isoformat()}
            vendor.side_effect=CloudflareINT01Denied()
            self.assertEqual(live.transition(domain.pk),"held")
            domain.refresh_from_db()
            self.assertEqual(domain.metadata[live.KEY]["state"],"uncertain")
            vendor.side_effect=None
            vendor.return_value={"domain_name":domain.domain_name,"state":"succeeded","completed":True}
            self.assertEqual(live.transition(domain.pk),"processed")
            self.assertEqual([x.args[3] for x in vendor.call_args_list],["create","status"])
            domain.refresh_from_db()
            self.assertEqual(domain.status,"active")
            self.assertEqual(domain.expiry_date,now+relativedelta(years=1))
            self.assertEqual(domain.order_item.order.status,"provisioned")
            self.assertEqual(live.transition(domain.pk),"held")
            self.assertEqual(vendor.call_count,2)

    def test_live_workflow_proof_documented_shapes(self):
        from providers.registrar_live_transport import workflow_proof
        from providers.cloudflare_int01 import CloudflareINT01Denied
        domain="example.com"
        path="/accounts/"+("a"*32)+"/registrar/registrations/"+domain+"/registration-status"
        for proof in ({"domain_name":domain},{"context":{"domain_name":domain}}):
            result=workflow_proof({**proof,"state":"in_progress","completed":False,"links":{"self":path}},domain,path)
            self.assertEqual(result["domain_name"],domain)
        with self.assertRaises(CloudflareINT01Denied):
            workflow_proof({"domain_name":domain,"context":{"domain_name":"other.com"},"state":"succeeded","completed":True},domain,path)
        with self.assertRaises(CloudflareINT01Denied):
            workflow_proof({"domain_name":domain,"state":"succeeded","completed":True,"links":{"self":"https://other.example/"}},domain,path)

    def test_abandoned_claim_release_never_releases_any_payment_intent(self):
        from . import live_registration as live
        from .reservation_recovery import release
        from django.core import signing
        from datetime import timedelta
        order=Order.objects.create(client=self.owner,status="pending_payment",currency="NGN")
        item=OrderItem.objects.create(order=order,item_type="domain",product_id=0,plan_id=0,billing_cycle_id=0,
            description="Abandoned registration",domain_name="abandoned.com",unit_price=Decimal("17000"),cycle_key="1yr",months=12)
        order.refresh_from_db()
        contact={"email":self.owner.email}
        grant={"owner":self.owner.pk,"order":order.pk,"item":item.pk,"domain":item.domain_name,"contact_digest":live.digest(contact)}
        domain=Domain.objects.create(client=self.owner,domain_name=item.domain_name,tld=".com",order_item=item,
            registrar="cloudflare-registrar-live",status="pending",is_active=False,registration_date=None,
            auto_renew=False,registrant_contact=contact,metadata={live.KEY:{"state":"queued","grant":signing.dumps(grant,salt=live.SALT)}})
        order.metadata={live.KEY:{"domain_id":domain.pk,"item":item.pk}}
        order.save(update_fields=["metadata"])
        invoice=Invoice.create_from_order(order)
        self.assertFalse(release(domain.pk))
        Domain.objects.filter(pk=domain.pk).update(created_at=timezone.now()-timedelta(hours=25))
        gateway=PaymentGateway.objects.create(code="paystack",name="Fixture",status="active",test_mode=False)
        intent=PaymentIntent.objects.create(client=self.owner,invoice=invoice,gateway=gateway,reference="ABANDONED_FIXTURE",
            status="expired",amount=invoice.total,expires_at=timezone.now()-timedelta(hours=1))
        self.assertFalse(release(domain.pk))
        # Only synthetic fixture deletion, to prove the no-intent case.
        intent.delete()
        self.assertTrue(release(domain.pk))
        self.assertFalse(Domain.objects.filter(pk=domain.pk).exists())
        invoice.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(invoice.status,"void")
        self.assertEqual(order.status,"cancelled")
        self.assertTrue(OrderItem.objects.filter(pk=item.pk).exists())

    def test_live_cart_two_domains_has_one_invoice_and_atomic_release(self):
        from . import live_registration as live
        from . import live_cart
        from .reservation_recovery import release
        from providers.connection_models import IntegrationConnection
        from datetime import timedelta
        from uuid import uuid4
        route={"connection_id":"00000000-0000-4000-8000-000000000001","credential_version":1,"revision":1}
        cost={"revision":1,"currency":"USD","registration_cost":"10.00","renewal_cost":"12.00","ngn_per_unit":"1500"}
        self.rate.metadata={**self.rate.metadata,"published_registrar":route,"published_registrar_cost_v1":cost}
        self.rate.save(update_fields=["metadata"])
        row=IntegrationConnection.objects.create(pk=route["connection_id"],adapter_key="cloudflare-registrar-live",state="draft",environment="live",label="Fixture",public_settings={"account_id":"a"*32})
        self.supplier.live_domain_check.side_effect=lambda n:{"name":n,"registrable":True,"currency":"USD","registration_cost":"10.00"}
        contact={"name":"Fixture","phone":"+234.8012345678","street":"Fixture Road","city":"Abuja","state":"FCT","country_code":"NG","postal_code":"900001"}
        PaymentGateway.objects.create(code="paystack",name="Live fixture",status="active",test_mode=False,config={})
        with patch("domains.live_registration.enabled",return_value=True),patch("domains.live_registration.resolve_live_key",return_value="fixture"),patch("domains.live_registration.connector",return_value=(row,"fixture",self.supplier)),patch("domains.live_cart.enabled",return_value=True),patch("domains.live_cart.load",return_value=(row,"fixture")):
            q=live_cart.quote_cart(self.owner,["alpha.com","beta.com"],[])
            self.assertEqual(q["total"],"34000.00")
            key=str(uuid4())
            result=live_cart.accept_cart(self.owner,q["quote"],contact,key)
            self.assertEqual(result,live_cart.accept_cart(self.owner,q["quote"],contact,key))
            invoice=Invoice.objects.get(public_id=result["invoice_public_id"])
            self.assertEqual(invoice.total,Decimal("34000"))
            self.assertTrue(live_cart.payment_ready(invoice))
            self.assertFalse(live_cart.all_domains_confirmed(invoice.order))
            self.assertEqual(Domain.objects.count(),2)
            Domain.objects.update(created_at=timezone.now()-timedelta(hours=25))
            self.assertTrue(release(Domain.objects.first().pk))
            self.assertEqual(Domain.objects.count(),0)
            invoice.refresh_from_db();self.assertEqual(invoice.status,"void")
