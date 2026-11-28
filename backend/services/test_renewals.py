from datetime import datetime,timezone
from unittest.mock import patch
from django.test import SimpleTestCase
from services.renewals import end_of_term,validate_policy,RenewalRefused,seal,unseal

class RenewalCalendarTests(SimpleTestCase):
    def test_month_end_anchor_survives_leap_february(self):
        start=datetime(2028,1,31,12,tzinfo=timezone.utc)
        feb=end_of_term(start,1,31)
        self.assertEqual(feb,datetime(2028,2,29,12,tzinfo=timezone.utc))
        self.assertEqual(end_of_term(feb,1,31),datetime(2028,3,31,12,tzinfo=timezone.utc))

    def test_annual_period_and_unsupported_term(self):
        start=datetime(2028,2,29,tzinfo=timezone.utc)
        self.assertEqual(end_of_term(start,12,29),datetime(2029,2,28,tzinfo=timezone.utc))
        for months in (0,2,-1,True):
            with self.assertRaises(RenewalRefused):
                end_of_term(start,months,29)

    def test_policy_requires_explicit_valid_values(self):
        p={"enabled":True,"invoice_lead_days":14,"reminder_days":7,"tax_mode":"exclusive","tax_rate":"7.50"}
        self.assertEqual(validate_policy(p),p)
        for change in ({"reminder_days":14},{"tax_rate":"NaN"},{"tax_rate":"31"},{"enabled":1},{"tax_mode":"unknown"}):
            with self.assertRaises(RenewalRefused):
                validate_policy({**p,**change})

    @patch("services.renewals.audit_keyring")
    def test_signed_term_is_context_bound_and_tamper_evident(self,keyring):
        keyring.return_value=("fixture",{"fixture":b"synthetic-unit-test-only"})
        value=seal({"term":"2028-01-31","total":"1000.00"},"renewal")
        self.assertEqual(unseal(value,"renewal")["total"],"1000.00")
        with self.assertRaises(RenewalRefused):
            unseal(value,"policy")
        value["payload"]["total"]="1.00"
        with self.assertRaises(RenewalRefused):
            unseal(value,"renewal")


class LifecyclePolicyTests(SimpleTestCase):
    def test_explicit_grace_and_restoration_policy(self):
        from services.hosting_lifecycle import validate_policy
        p={"enabled":True,"grace_days":3,"restore_enabled":False}
        self.assertEqual(validate_policy(p),p)
        for bad in ({**p,"grace_days":0},{**p,"restore_enabled":1},{**p,"terminate":True}):
            with self.assertRaises(RenewalRefused):
                validate_policy(bad)

class CancellationPolicyTests(SimpleTestCase):
    def test_retention_policy_is_explicit_and_bounded(self):
        from services.hosting_cancellation import validate_policy
        value={"enabled":True,"retention_days":30,"termination_enabled":False}
        self.assertEqual(validate_policy(value),value)
        for bad in ({**value,"retention_days":29},{**value,"termination_enabled":1},{**value,"retention_days":366}):
            with self.assertRaises(RenewalRefused):
                validate_policy(bad)


from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from django.contrib.auth import get_user_model
from django.test import TestCase,override_settings
from django.utils import timezone as dj_time
from billing.models import Invoice
from catalog.models import ProductCategory,Product,Plan,PlanBillingCycle,PublishedCatalogOffer
from orders.models import Order,OrderItem
from payments.models import PaymentGateway,Transaction
from providers.models import Provider
from providers.connection_models import IntegrationConnection
from opanel_bridge.models import VerifiedHostingBinding
from settings_registry.models import EmailTemplate,ConsoleMailOutbox
from services.models import Service
from services import renewals,hosting_lifecycle as lifecycle,hosting_cancellation as cancel

@override_settings(CLOUD_HOSTING_RENEWALS_ENABLED=True,CLOUD_HOSTING_LIFECYCLE_ENABLED=True,
    CLOUD_HOSTING_CANCELLATION_ENABLED=True,CLOUD_HOSTING_TERMINATION_ENABLED=False)
class RenewalLifecycleDatabaseTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username="renewal-fixture",email="renewal@example.test",role="client")
        self.provider=Provider.objects.create(name="Fixture",adapter_type="CpanelAdapter",
            base_url="https://supplier.example.test:2087",username="reseller",status="active",health_status="healthy",test_mode=False)
        self.connection=IntegrationConnection.objects.create(adapter_key="cpanel",label="Fixture lifecycle",environment="live")
        self.gateway=PaymentGateway.objects.create(code="paystack",name="Fixture",status="active",test_mode=False)
        category=ProductCategory.objects.create(name="Fixture hosting")
        product=Product.objects.create(category=category,name="Fixture hosting")
        plan=Plan.objects.create(product=product,name="Starter",currency="NGN")
        cycle=PlanBillingCycle.objects.create(plan=plan,cycle_key="1mo",months=1,price=1000)
        PublishedCatalogOffer.objects.create(plan=plan,revision=1,snapshot={"supplier_provider_id":self.provider.pk,
            "technical_package_id":"starter","currency":"NGN","billing_cycles":[{"cycle_key":"1mo","price":"1000.00"}]})
        order=Order.objects.create(client=self.user,status="provisioned",currency="NGN",paid_at=dj_time.now())
        item=OrderItem.objects.create(order=order,product_id=product.pk,plan_id=plan.pk,billing_cycle_id=cycle.pk,
            item_type="hosting",description="Starter",domain_name="fixture.example.test",unit_price=1000,quantity=1,cycle_key="1mo",months=1)
        invoice=Invoice.objects.create(client=self.user,order=order,status="paid",currency="NGN",subtotal=1000,total=1000,
            amount_paid=1000,due_date=dj_time.now(),paid_at=dj_time.now())
        self.payment(invoice,"INITIAL_FIXTURE", "12345")
        self.service=Service.objects.create(client=self.user,order=order,order_item=item,invoice=invoice,product_id=product.pk,
            plan_id=plan.pk,provider_id=self.provider.pk,provider_identifier="oc000001",provider_package_id="starter",
            service_type="hosting",status="active",label="Starter",domain_name="fixture.example.test",billing_cycle="1mo",
            amount=1000,currency="NGN",activated_at=dj_time.now()-timedelta(days=20),next_due_date=dj_time.now()+timedelta(days=5))
        self.proof=VerifiedHostingBinding.objects.create(service=self.service,provider_id_snapshot=self.provider.pk,
            account_digest="a"*64,confirmation_source="provider_api_readback",confirmed_at=dj_time.now())
        for target,value in (("services.renewals.qualified_vault",True),("services.hosting_lifecycle.qualified_vault",True),
            ("services.renewals.account_digest","a"*64),("services.renewals.audit_keyring",("fixture",{"fixture":b"synthetic-only-test-key"}))):
            mock=patch(target,return_value=value);mock.start();self.addCleanup(mock.stop)
        renewals.save_policy({"enabled":True,"invoice_lead_days":14,"reminder_days":7,"tax_mode":"exclusive","tax_rate":"5"},self.user)
        lifecycle.save_policy({"enabled":True,"grace_days":3,"restore_enabled":True},self.user)

    def payment(self,invoice,reference,remote):
        return Transaction.objects.create(client=self.user,invoice=invoice,gateway=self.gateway,reference=reference,
            provider_reference=remote,transaction_type="payment",status="successful",currency="NGN",amount=invoice.total,
            net_amount=invoice.total,paid_at=dj_time.now(),metadata={"verification_source":"provider_api_verified","provider_api_verified":True,"verified_remote_id":remote})

    def settle(self,invoice):
        invoice.status="paid";invoice.amount_paid=invoice.total;invoice.paid_at=dj_time.now();invoice.save()
        order=invoice.order;order.status="paid";order.paid_at=dj_time.now();order.save()
        self.payment(invoice,"RENEW_FIXTURE","67890")

    def test_renewal_invoice_reminder_and_exactly_once_extension(self):
        start=self.service.next_due_date
        template=EmailTemplate.objects.get(key="invoice_due");template.is_active=True;template.save(update_fields=["is_active"])
        invoice,created=renewals.issue(self.service.pk)
        self.assertTrue(created)
        self.assertEqual(invoice.total,Decimal("1050.00"))
        self.assertEqual(renewals.issue(self.service.pk)[0].pk,invoice.pk)
        self.assertEqual(renewals.queue_due_reminders(),1)
        self.assertEqual(renewals.queue_due_reminders(),0)
        notice=ConsoleMailOutbox.objects.get(idempotency_key=f"invoice:{invoice.pk}:renewal_reminder")
        from settings_registry.mail_runtime import current_message
        self.assertTrue(current_message(notice))
        self.settle(invoice)
        self.assertFalse(current_message(notice))
        self.assertTrue(renewals.apply(invoice.pk))
        self.assertFalse(renewals.apply(invoice.pk))
        self.service.refresh_from_db()
        self.assertEqual(self.service.next_due_date,end_of_term(start,1,start.day))
        self.assertEqual(Service.objects.count(),1)

    def test_nonpayment_suspend_and_restore_requires_exact_remote_marker(self):
        self.service.next_due_date=dj_time.now()-timedelta(days=4)
        self.service.save(update_fields=["next_due_date"])
        invoice,_=renewals.issue(self.service.pk)
        protocol=Mock()
        remote={"state":"active","reason":""}
        def change(operation,marker,**kw):
            remote.update(state="suspended" if operation=="suspend" else "active",
                          reason=marker if operation=="suspend" else "")
        protocol.lifecycle_state.side_effect=lambda:remote.copy()
        protocol.lifecycle_write.side_effect=change
        row=self.connection
        with patch("services.hosting_lifecycle._authority",return_value=(self.proof,self.provider,row,protocol)):
            self.assertEqual(lifecycle.advance(self.service.pk,invoice.pk,"suspend"),"confirmed")
            self.service.refresh_from_db()
            self.assertEqual(self.service.status,"suspended")
            self.settle(invoice)
            self.assertTrue(renewals.apply(invoice.pk))
            marker=remote["reason"];remote["reason"]="Security hold"
            self.assertEqual(lifecycle.advance(self.service.pk,invoice.pk,"restore"),"held")
            protocol.lifecycle_write.assert_called_once()
            remote["reason"]=marker
            self.assertEqual(lifecycle.advance(self.service.pk,invoice.pk,"restore"),"confirmed")
            self.service.refresh_from_db()
            self.assertEqual(self.service.status,"active")
            self.assertEqual(protocol.lifecycle_write.call_count,2)

    def test_cancellation_keeps_paid_term_and_requires_notice(self):
        from services.lifecycle_requests import request_service_cancellation
        cancel.save_policy({"enabled":True,"retention_days":30,"termination_enabled":False},self.user)
        request,_=request_service_cancellation(self.service.pk,actor=self.user)
        protocol=Mock()
        row=self.connection
        with patch("services.hosting_lifecycle._authority",return_value=(self.proof,self.provider,row,protocol)):
            state=cancel.approve(self.service.pk,request.pk,self.user)
            self.assertEqual(state["state"],"scheduled")
            self.service.refresh_from_db()
            self.assertEqual(self.service.status,"active")
            self.assertFalse(self.service.auto_renew)
            self.assertEqual(cancel.advance(self.service.pk),"waiting")
            protocol.lifecycle_write.assert_not_called()
            with self.assertRaises(RenewalRefused):
                cancel.authorize_removal(self.service.pk,self.user,self.service.domain_name,"fixture-backup-1")


class CommercialSchedulerTests(TestCase):
    def test_disabled_and_untrusted_calls_never_run(self):
        from rest_framework.test import APIClient
        api=APIClient()
        with patch.dict("os.environ",{"CRON_SECRET":"synthetic-scheduler-credential-only-123456"}),override_settings(CLOUD_COMMERCIAL_SCHEDULER_ENABLED=False),patch("services.commercial_scheduler.run_lane") as run:
            path="/api/services/commercial-worker/mail/cron/"
            self.assertEqual(api.get(path).status_code,401)
            self.assertEqual(api.get(path,HTTP_AUTHORIZATION="Bearer synthetic-scheduler-credential-only-123456").json(),{"enabled":False})
            self.assertEqual(api.get("/api/services/commercial-worker/other/cron/",HTTP_AUTHORIZATION="Bearer synthetic-scheduler-credential-only-123456").status_code,404)
            run.assert_not_called()
    @override_settings(CLOUD_COMMERCIAL_SCHEDULER_ENABLED=True)
    def test_postgres_lease_fences_overlapping_workers(self):
        from django.db import connection
        from services.commercial_scheduler import claim,finish,status
        if connection.vendor!="postgresql":
            self.skipTest("Production lease uses PostgreSQL.")
        token=claim("mail")
        self.assertTrue(token)
        self.assertIsNone(claim("mail"))
        finish("mail","incorrect",{"accepted":99})
        self.assertIsNone(claim("mail"))
        finish("mail",token,{"accepted":1,"secret":"must-not-store"})
        self.assertEqual(next(x for x in status() if x["lane"]=="mail")["metrics"],{"accepted":1})
        self.assertTrue(claim("mail"))
