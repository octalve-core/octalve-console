import json
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from domains.pilot import QUOTE_SALT, accept_quote, pilot_readiness, reconcile
from domains.models import TLDPricing
from payments.domain_pilot_scope import PILOT
from payments.hosted_checkout import reserve_hosted_checkout
from payments.models import PaymentGateway, PaymentIntent, Transaction, WebhookEvent
from payments.readback import ConfirmedGatewayPayment, PaymentReadbackRejected, verify_gateway_intent
from payments.test_checkout_webhooks import reply
from payments.sandbox import gateway_can_read
from providers.cloudflare_int01 import CloudflareINT01, CloudflareINT01Denied


class DomainPilotTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username="pilot", email="pilot@example.test", role="client", state="Lagos", country="NG",
            email_verified_at=timezone.now(),
        )
        self.domain = "octalve-pilot.com"
        scope = patch.dict("os.environ", {
            "VERCEL_ENV": "production",
            "CLOUD_DOMAIN_PILOT_ENABLED": "true",
            "CLOUD_DOMAIN_PILOT_CLIENT_ID": str(self.owner.pk),
            "CLOUD_DOMAIN_PILOT_NAME": self.domain,
            "CLOUD_DOMAIN_PILOT_CONTACT_JSON": json.dumps({
                "email": "pilot@example.test", "phone": "+1.2025550111",
                "postal_info": {"name": "Octalve Pilot", "address": {
                    "street": "123 Example Street", "city": "Example", "state": "CA",
                    "country_code": "US", "postal_code": "90001",
                }},
            }),
        })
        scope.start()
        self.addCleanup(scope.stop)
        TLDPricing.objects.create(tld=".com", register_price=12500, renewal_price=13500, transfer_price=12000)
        self.token = signing.dumps({
            "client": self.owner.pk, "domain": self.domain, "amount": "12500.00",
            "price_revision": 0, "registrar": {"connection": "fixture", "version": 1},
        }, salt=QUOTE_SALT)
        self.supplier = Mock()
        connector = patch("domains.pilot.registrar", return_value=(self.supplier, {}))
        connector.start()
        self.addCleanup(connector.stop)
        self.gateway = PaymentGateway.objects.create(
            code="paystack", name="Test", status="test", test_mode=True,
            config={"provider_vault_connection_id": "fixture", "provider_vault_version": 1},
        )

    def test_scopes_checkout_to_marked_invoice(self):
        order = accept_quote(self.owner, self.domain, self.token)
        self.assertEqual(accept_quote(self.owner, self.domain, self.token).pk, order.pk)
        invoice = order.invoices.get()
        self.assertTrue(gateway_can_read(self.gateway, invoice))
        self.assertEqual(invoice.metadata["billing_contact"]["state"], "Lagos")
        self.assertEqual(invoice.metadata["billing_contact"]["country"], "NG")
        self.assertFalse(gateway_can_read(self.gateway))
        invoice.metadata = {}
        self.assertFalse(gateway_can_read(self.gateway, invoice))

    @override_settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=True)
    def test_customer_can_use_search_name_and_pinned_price_instead_of_legacy_name(self):
        route = {"connection_id": "fixture", "credential_version": 1, "revision": 2}
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar": route})
        name = "selected-by-customer.com"
        other = get_user_model().objects.create_user(
            username="otherclient", email="other@example.test", role="client", email_verified_at=timezone.now(),
        )
        api = APIClient()
        path = f"/api/domains/sandbox-purchase/?domain={name}"
        api.force_authenticate(other)
        self.assertEqual(api.get(path).status_code, 404)
        api.force_authenticate(self.owner)
        self.assertEqual(api.get(path).data["domain"], name)
        self.supplier.check.return_value = {"registrable": True}
        with patch("domains.pilot.pilot_readiness", return_value=[]), patch(
            "domains.pilot.query_published_registrar", return_value={"registrable": True},
        ) as lookup:
            quote = api.post(path, {"action": "quote"}, format="json")
        self.assertEqual(quote.status_code, 200, quote.data)
        lookup.assert_called_once_with(route, name)
        accepted = api.post(path, {"action": "accept", "quote": quote.data["quote"]}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data["domain"], name)
        order = self.owner.orders.get(order_number=accepted.data["order"])
        self.assertEqual(order.metadata[PILOT]["live_route"], route)
        invoice = order.invoices.get()
        from billing.serializers import InvoiceSerializer
        invoice_data = InvoiceSerializer(invoice).data
        self.assertEqual(invoice_data["payment_resume"], {"kind": "domain", "domain": name})
        self.assertEqual(invoice_data["checkout_context"], {"kind": "domain", "domain": name})
        exact = f"{path}&invoice={invoice.pk}"
        self.assertEqual(api.get(exact).data["purchase"]["invoice_id"], invoice.pk)
        self.assertEqual(api.get(f"{path}&invoice={invoice.pk + 9999}").status_code, 404)
        self.assertEqual(api.post(exact, {"action": "quote"}, format="json").status_code, 400)
        self.assertEqual(api.post(exact, {"action": "accept", "quote": quote.data["quote"]}, format="json").status_code, 400)
        self.assertEqual(order.invoices.count(), 1)

        self.assertFalse(invoice_data["payment_action_allowed"])
        self.assertTrue(gateway_can_read(self.gateway, invoice))
        def send(_url, **kwargs):
            body = kwargs["json"]
            self.assertEqual(body["callback_url"],
                             f"https://console.cloud.octalve.com/client/order/checkout?view=invoice&invoice={invoice.public_id}&returning=1")
            return reply({"status": True, "data": {"reference": body["reference"],
                         "authorization_url": "https://checkout.paystack.com/test_12345"}})

        with self.settings(CLOUD_HOSTED_CHECKOUT_ENABLED=True, CLOUD_PAYMENT_RETURN_URL="https://console.cloud.octalve.com/client/order/processing"), patch.object(
            PaymentGateway, "get_secret_key", return_value="sk_test_example_fixture_0123456789",
        ):
            intent, created = reserve_hosted_checkout(invoice.pk, "paystack", poster=send)
        self.assertTrue(created)
        self.assertEqual(intent.reference, invoice.payment_intents.get().reference)
        with self.settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=False):
            self.assertFalse(gateway_can_read(self.gateway, invoice))

    @override_settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=True)
    def test_recover_selected_order_blocked_before_transport_only_once(self):
        order = accept_quote(self.owner, self.domain, self.token)
        snapshot = order.metadata[PILOT]
        snapshot.update(domain="selected-by-customer.com", selected_domain=True,
                        state="registration_uncertain", payment_reference="OC-RECOVERY", payment_remote_id="42")
        order.save(update_fields=["metadata"])
        invoice = order.invoices.get()
        invoice.status = "void"
        invoice.save(update_fields=["status"])
        intent = PaymentIntent.objects.create(
            invoice=invoice, client=self.owner, gateway=self.gateway, reference="OC-RECOVERY",
            status="completed", amount=invoice.total, currency="NGN",
            expires_at=timezone.now() + timezone.timedelta(minutes=1),
        )
        WebhookEvent.objects.create(
            gateway=self.gateway, is_verified=True, event_type="charge.success", event_id="recovery-test",
            payload={"reference": intent.reference, "remote_id": "42", "intent_id": intent.pk},
        )
        transport = Mock(return_value={"success": True, "result": {"state": "pending", "completed": False}})
        adapter = CloudflareINT01("a" * 32, transport)
        self.supplier.submit_pilot_registration.side_effect = adapter.submit_pilot_registration
        self.supplier.pilot_registration_status.return_value = {"state": "pending"}
        with patch.dict("os.environ", {"CLOUD_SANDBOX_LOCALLY_BLOCKED_ORDER": order.order_number}):
            reconcile(order)
            order.refresh_from_db()
            self.assertTrue(order.metadata[PILOT]["sandbox_submission_reserved"])
            reconcile(order)
        transport.assert_called_once()
        verb, path, payload = transport.call_args.args
        self.assertEqual(verb, "POST")
        self.assertTrue(path.endswith("/registrar-sandbox/registrations"))
        self.assertEqual(payload["domain_name"], "selected-by-customer.com")

    def test_timeout_never_resubmits_and_success_never_posts_revenue(self):
        order = accept_quote(self.owner, self.domain, self.token)
        invoice = order.invoices.get()
        intent = PaymentIntent.objects.create(
            invoice=invoice, client=self.owner, gateway=self.gateway, reference="OC-PILOT-TEST",
            amount=invoice.total, currency="NGN", status="pending",
            expires_at=timezone.now() - timezone.timedelta(minutes=2),
        )
        WebhookEvent.objects.create(
            gateway=self.gateway, is_verified=True, event_type="charge.success", event_id="pilot-test",
            payload={"reference": intent.reference, "remote_id": "123", "intent_id": intent.pk},
        )
        self.supplier.submit_pilot_registration.side_effect = CloudflareINT01Denied
        proof = ConfirmedGatewayPayment("paystack", intent.reference, "NGN", Decimal("12500.00"), "123")
        with patch("domains.pilot.verify_gateway_intent", return_value=proof):
            reconcile(order)
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"], "registration_uncertain")
        self.supplier.pilot_registration_status.return_value = {"state": "succeeded"}
        self.supplier.get_registration.return_value = {
            "domain_name": self.domain, "sandbox_status": "active",
            "registered_at": "2026-11-22T12:00:00+00:00", "expires_at": "2027-11-22T12:00:00+00:00",
        }
        reconcile(order)
        order.refresh_from_db()
        invoice.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"], "registered")
        self.assertEqual(invoice.status, "void")
        self.assertEqual(invoice.collectible_amount, Decimal("0.00"))
        from billing.serializers import InvoiceItemSerializer
        from billing.invoice_pdf import _document
        line = invoice.items.get()
        self.assertEqual(InvoiceItemSerializer(line).data["confirmed_period"], {
            "kind": "domain", "start": "2026-11-22T12:00:00+00:00", "end": "2027-11-22T12:00:00+00:00",
        })
        self.assertIn("Registered 22 Nov 2026; Expires 22 Nov 2027", _document(invoice).lines[0].description)
        self.assertFalse(Transaction.objects.exists())
        self.supplier.submit_pilot_registration.assert_called_once()

    @override_settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=True)
    def test_combined_cart_one_invoice_distinct_registrar_submissions_and_no_revenue(self):
        from uuid import uuid4
        from billing.models import Invoice
        from catalog.models import Plan, PlanBillingCycle, Product, ProductCategory
        from catalog.test_published_fixture import attach_test_published_offer
        from orders.models import Order
        from payments.domain_pilot_scope import CART

        connector = patch("domains.combined_cart.registrar", return_value=(self.supplier, {}))
        connector.start()
        self.addCleanup(connector.stop)

        category = ProductCategory.objects.create(name="Hosting")
        product = Product.objects.create(category=category, name="Hosting", product_type="shared_hosting",
                                         status="active", is_public=True)
        plan = Plan.objects.create(product=product, name="Starter", status="active", is_public=True, currency="NGN")
        cycle = PlanBillingCycle.objects.create(plan=plan, cycle_key="1mo", months=1, is_active=True,
                                               price=Decimal("3000.00"), setup_fee=Decimal("0.00"))
        attach_test_published_offer(plan, cycle)
        route = {"connection_id": "fixture", "credential_version": 1, "revision": 2}
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar": route})
        api = APIClient()
        api.force_authenticate(self.owner)
        path = "/api/domains/combined-cart/"
        names = ["first-example.com", "second-example.com"]
        self.supplier.check.return_value = {"registrable": True}
        with patch("domains.combined_cart.pilot_readiness", return_value=[]), patch(
            "domains.pilot.query_published_registrar", return_value={"registrable": True},
        ):
            quoted = api.post(path, {"action": "quote", "domains": names, "services": [
                {"plan_id": plan.pk, "offer_revision": 1, "cycle_key": "1mo", "domain_name": names[0]},
            ]}, format="json")
        self.assertEqual(quoted.status_code, 200, quoted.data)
        self.assertEqual(Decimal(quoted.data["total"]), Decimal("28000.00"))
        self.assertFalse(Order.objects.exists())
        data = {"action": "accept", "quote": quoted.data["quote"], "checkout_id": str(uuid4())}
        created = api.post(path, data, format="json")
        self.assertEqual(created.status_code, 200, created.data)
        self.assertEqual(api.post(path, data, format="json").data["invoice_id"], created.data["invoice_id"])
        invoice = Invoice.objects.get()
        self.assertEqual(invoice.items.count(), 3)
        self.assertEqual(invoice.metadata["billing_contact"]["state"], "Lagos")
        self.assertTrue(invoice.metadata[CART])
        self.assertTrue(gateway_can_read(self.gateway, invoice))
        self.assertEqual(str(invoice.total), "28000.00")

        def send(_url, **kwargs):
            body = kwargs["json"]
            self.assertEqual(body["amount"], "2800000")
            self.assertEqual(body["callback_url"],
                             f"https://console.cloud.octalve.com/client/order/checkout?view=invoice&invoice={invoice.public_id}&returning=1")
            return reply({"status": True, "data": {"reference": body["reference"],
                         "authorization_url": "https://checkout.paystack.com/test_12345"}})

        with self.settings(CLOUD_HOSTED_CHECKOUT_ENABLED=True, CLOUD_PAYMENT_RETURN_URL="https://console.cloud.octalve.com/client/order/processing"), patch.object(
                PaymentGateway, "get_secret_key", return_value="sk_test_example_fixture_0123456789"):
            intent, _ = reserve_hosted_checkout(invoice.pk, "paystack", poster=send)
        proof = ConfirmedGatewayPayment("paystack", intent.reference, "NGN", invoice.total, "234")
        status_url = f"{path}?invoice={invoice.pk}"
        first, second = created.data["domains"]
        with patch("domains.pilot.verify_gateway_intent", return_value=proof):
            unsigned = api.post(status_url, {"action": "reconcile", "line_id": first["id"]}, format="json")
        self.assertEqual(unsigned.status_code, 400, unsigned.data)
        waiting = api.post(status_url, {"action": "advance"}, format="json")
        self.assertEqual(waiting.status_code, 200, waiting.data)
        self.assertTrue(waiting.data["payment_started"])
        self.assertFalse(waiting.data["payment_verified"])
        self.supplier.submit_cart_registration.assert_not_called()

        WebhookEvent.objects.create(
            gateway=self.gateway, is_verified=True, event_type="charge.success", event_id="cart-test",
            payload={"reference": intent.reference, "remote_id": "234", "intent_id": intent.pk},
        )
        # A second exact signed inbox row is ambiguous: refuse and leave all state untouched.
        duplicate = WebhookEvent.objects.create(gateway=self.gateway, is_verified=True, event_type="charge.success", event_id="cart-duplicate-fixture", payload={"reference": intent.reference, "remote_id": "234", "intent_id": intent.pk})
        with patch("domains.pilot.verify_gateway_intent", return_value=proof):
            denied = api.post(status_url, {"action":"advance"}, format="json")
        self.assertEqual(denied.status_code,400)
        intent.refresh_from_db()
        invoice.refresh_from_db()
        self.assertEqual(intent.status,"pending")
        self.assertEqual(invoice.status,"unpaid")
        self.assertFalse(WebhookEvent.objects.get(event_id="cart-test").is_processed)
        duplicate.delete()  # disposable test fixture only
        self.supplier.submit_cart_registration.side_effect = [CloudflareINT01Denied(), {"state": "failed"}]
        with patch("domains.pilot.verify_gateway_intent", return_value=proof):
            paid = api.post(status_url, {"action": "advance"}, format="json")
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertTrue(paid.data["payment_verified"])
        event = WebhookEvent.objects.get(event_id="cart-test")
        self.assertTrue(event.is_processed)
        self.assertIsNotNone(event.processed_at)
        self.supplier.submit_cart_registration.assert_not_called()
        from domains.sandbox_fulfillment import advance_approved_order
        with patch.dict("os.environ", {"CLOUD_REGISTRAR_SANDBOX_AUTOMATION_ENABLED": "true",
                                     "CLOUD_REGISTRAR_SANDBOX_ORDER_ID": str(invoice.order.public_id)}):
            self.assertEqual(advance_approved_order(), "advanced")
        first_result = api.get(status_url)
        self.assertEqual(first_result.status_code, 200, first_result.data)
        self.assertEqual(first_result.data["domains"][0]["state"], "registration_uncertain")
        self.supplier.pilot_registration_status.return_value = {"state": "succeeded"}
        self.supplier.get_registration.return_value = {
            "sandbox_status": "active", "registered_at": "2026-11-23T00:00:00Z",
            "expires_at": "2027-11-23T00:00:00Z",
        }
        reread = api.post(status_url, {"action": "reconcile", "line_id": first["id"]}, format="json")
        self.assertEqual(reread.data["domains"][0]["state"], "registered")
        last = api.post(status_url, {"action": "advance"}, format="json")
        self.assertEqual(last.data["domains"][1]["state"], "registration_rejected")
        self.assertEqual(self.supplier.submit_cart_registration.call_count, 2)
        self.supplier.pilot_registration_status.assert_called_once_with(first["name"])
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "void")
        self.assertEqual(invoice.items.get(description=f'{first["name"]} registration').metadata["confirmed_period"]["kind"], "domain")
        self.assertFalse(Transaction.objects.exists())

    def test_registrar_rejection_is_terminal(self):
        order = accept_quote(self.owner, self.domain, self.token)
        order.metadata[PILOT]["state"] = "registration_uncertain"
        order.save(update_fields=["metadata"])
        self.supplier.pilot_registration_status.return_value = {"state": "failed"}
        reconcile(order)
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"], "registration_rejected")
        reconcile(order)
        self.supplier.pilot_registration_status.assert_called_once_with(self.domain)
        self.supplier.submit_pilot_registration.assert_not_called()
        self.supplier.get_registration.assert_not_called()

    @override_settings(CLOUD_GATEWAY_READBACK_ENABLED=True)
    def test_expired_reference_readback_can_report_failure_without_a_registration(self):
        order = accept_quote(self.owner, self.domain, self.token)
        invoice = order.invoices.get()
        intent = PaymentIntent.objects.create(
            invoice=invoice, client=self.owner, gateway=self.gateway, reference="OC-PILOT-EXPIRED",
            amount=invoice.total, currency="NGN", status="pending",
            expires_at=timezone.now() - timezone.timedelta(minutes=1),
        )
        packet = {"status": True, "data": {"status": "abandoned", "domain": "test",
                  "reference": intent.reference, "amount": 1250000, "currency": "NGN", "id": 123}}
        with patch.object(PaymentGateway, "get_secret_key", return_value="sk_test_fixture_key"):
            self.assertEqual(verify_gateway_intent(
                intent, getter=Mock(return_value=reply(packet)), inspect_pilot=True), "abandoned")
            for change in ({"domain": "live"}, {"domain": None}, {"domain": "unexpected"}, {"amount": 1250001}, {"reference": "another_ref"}):
                altered = {**packet, "data": {**packet["data"], **change}}
                with self.assertRaises(PaymentReadbackRejected):
                    verify_gateway_intent(intent, getter=Mock(return_value=reply(altered)), inspect_pilot=True)
        self.supplier.submit_pilot_registration.assert_not_called()

    def test_preflight_explains_missing_gateway_and_contact(self):
        with patch.dict("os.environ", {"CLOUD_DOMAIN_PILOT_CONTACT_JSON": "{}"}):
            issues = pilot_readiness(self.owner.pk)
        self.assertIn("Configure the sandbox registrant contact on the API.", issues)
        self.assertIn("Bind a currently verified Paystack Test Mode connection.", issues)

    @override_settings(CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=True)
    def test_public_payment_only_never_calls_registrar_or_records_revenue(self):
        route = {"connection_id": "fixture", "credential_version": 1, "revision": 2}
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar": route})
        customer = get_user_model().objects.create_user(
            username="publictrial", email="publictrial@example.test", role="client",
            email_verified_at=timezone.now(),
        )
        api = APIClient()
        name = "public-trial-example.com"
        path = f"/api/domains/sandbox-purchase/?domain={name}"
        api.force_authenticate(customer)
        self.assertTrue(api.get(path).data["public_payment_test"])
        with patch("domains.pilot.registrar") as registrar_call, patch(
            "domains.pilot.query_published_registrar", return_value={"registrable": True},
        ), patch("domains.pilot.pilot_readiness", return_value=[]):
            quote = api.post(path, {"action": "quote"}, format="json")
            self.assertEqual(quote.status_code, 200, quote.data)
            accepted = api.post(path, {"action": "accept", "quote": quote.data["quote"]}, format="json")
            self.assertEqual(accepted.status_code, 200, accepted.data)
            order = customer.orders.get(order_number=accepted.data["order"])
            self.assertTrue(order.metadata[PILOT]["public_payment_test"])
            invoice = order.invoices.get()
            self.assertTrue(gateway_can_read(self.gateway, invoice))
            self.gateway.test_mode = False
            self.assertFalse(gateway_can_read(self.gateway, invoice))
            self.gateway.test_mode = True
            intent = PaymentIntent.objects.create(
                invoice=invoice, client=customer, gateway=self.gateway, reference="OC-PUBLIC-TEST",
                amount=invoice.total, currency="NGN", status="pending",
                expires_at=timezone.now() + timezone.timedelta(minutes=5),
            )
            proof = ConfirmedGatewayPayment("paystack", intent.reference, "NGN", invoice.total, "456")
            with patch("domains.pilot.verify_gateway_intent", return_value=proof):
                self.assertEqual(api.post(path, {"action": "reconcile"}, format="json").status_code, 400)
                WebhookEvent.objects.create(gateway=self.gateway, is_verified=True,
                    event_type="charge.success", event_id="public-trial",
                    payload={"reference": intent.reference, "remote_id": "456", "intent_id": intent.pk})
                result = api.post(path, {"action": "reconcile"}, format="json")
            self.assertEqual(result.status_code, 200, result.data)
            self.assertEqual(result.data["state"], "test_payment_verified")
            registrar_call.assert_not_called()
            invoice.refresh_from_db()
            intent.refresh_from_db()
            self.assertEqual(invoice.status, "void")
            self.assertEqual(intent.status, "completed")
            event = WebhookEvent.objects.get(event_id="public-trial")
            self.assertTrue(event.is_processed)
            self.assertIsNotNone(event.processed_at)
            self.assertFalse(Transaction.objects.exists())
            self.assertEqual(api.post(path, {"action": "reconcile"}, format="json").data["state"], "test_payment_verified")
        api.force_authenticate(self.owner)
        self.assertIsNone(api.get(path).data["purchase"])
        api.force_authenticate(customer)
        with self.settings(CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=False):
            self.assertEqual(api.get(path).status_code, 404)
        customer.email_verified_at = None
        customer.save(update_fields=["email_verified_at"])
        self.assertEqual(api.get(path).status_code, 404)

    @override_settings(CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=True, CLOUD_HOSTED_CHECKOUT_ENABLED=True,
                       CLOUD_PAYMENT_RETURN_URL="https://console.cloud.octalve.com/client/order/processing")
    def test_unified_public_cart_domain_and_service_payment_only(self):
        from uuid import uuid4
        from billing.models import Invoice
        from catalog.models import Plan, PlanBillingCycle, Product, ProductCategory
        from catalog.test_published_fixture import attach_test_published_offer
        from payments.domain_pilot_scope import CART
        category = ProductCategory.objects.create(name="Unified Hosting")
        product = Product.objects.create(category=category, name="Hosting", product_type="shared_hosting",
                                         status="active", is_public=True)
        plan = Plan.objects.create(product=product, name="Starter", status="active", is_public=True, currency="NGN")
        cycle = PlanBillingCycle.objects.create(plan=plan, cycle_key="1mo", months=1, is_active=True,
                                               price=Decimal("3000.00"), setup_fee=Decimal("500.00"))
        attach_test_published_offer(plan, cycle)
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar": {
            "connection_id": "fixture", "credential_version": 1, "revision": 2}})
        customer = get_user_model().objects.create_user(username="unified", email="unified@example.test",
            role="client", email_verified_at=timezone.now())
        api = APIClient()
        api.force_authenticate(customer)
        path = "/api/domains/combined-cart/"
        service = {"plan_id": plan.pk, "offer_revision": 1, "cycle_key": "1mo", "quantity": 1}
        with patch("domains.combined_cart.registrar") as supplier, patch("domains.pilot.registrar") as single_supplier, patch("domains.pilot.spend_durable_attempt", return_value=0):
            for domains, services, amount in [
                (["a-test.com"], [], Decimal("12500.00")),
                (["b-test.com", "c-test.com"], [service], Decimal("28500.00")),
                ([], [service], Decimal("3500.00")),
            ]:
                quote = api.post(path, {"action": "quote", "domains": domains, "services": services}, format="json")
                self.assertEqual(quote.status_code, 200, quote.data)
                self.assertEqual(Decimal(quote.data["total"]), amount)
                payload = {"action": "accept", "quote": quote.data["quote"], "checkout_id": str(uuid4())}
                self.assertEqual(api.post(path, {**payload, "action": "pay", "gateway": "paystack"}, format="json").status_code, 400)
                self.assertEqual(api.post(path, {**payload, "action": "pay", "gateway": "flutterwave", "consent": True}, format="json").status_code, 400)
                self.assertFalse(customer.orders.filter(metadata__combined_domain_test_cart__checkout_id=payload["checkout_id"]).exists())
                created = api.post(path, payload, format="json")
                self.assertEqual(created.status_code, 200, created.data)
                self.assertEqual(api.post(path, payload, format="json").data["invoice_id"], created.data["invoice_id"])
                invoice = Invoice.objects.get(pk=created.data["invoice_id"])
                self.assertEqual(invoice.total, amount)
                self.assertIsNone(created.data["payment_reference"])
                self.assertEqual(sum(item.subtotal for item in invoice.items.all()), amount)
                self.assertTrue(invoice.order.metadata[CART]["public_payment_test"])
                self.assertTrue(gateway_can_read(self.gateway, invoice))
                self.gateway.test_mode = False
                self.assertFalse(gateway_can_read(self.gateway, invoice))
                self.gateway.test_mode = True
                def send(_url, **kwargs):
                    body = kwargs["json"]
                    self.assertEqual(body["amount"], str(int(amount * 100)))
                    self.assertIn(f"view=invoice&invoice={invoice.public_id}&returning=1", body["callback_url"])
                    return reply({"status": True, "data": {"reference": body["reference"],
                         "authorization_url": "https://checkout.paystack.com/test_12345"}})
                with patch.object(PaymentGateway, "get_secret_key", return_value="sk_test_example_fixture_0123456789"):
                    intent, _ = reserve_hosted_checkout(invoice.pk, "paystack", poster=send)
                with patch("domains.combined_cart.start_cart_payment", return_value=intent.authorization_url) as start:
                    paid = api.post(path, {**payload, "action": "pay", "gateway": "paystack", "consent": True}, format="json")
                    self.assertEqual(paid.status_code, 200, paid.data)
                    self.assertEqual(paid.data["invoice_id"], invoice.pk)
                    self.assertEqual(paid.data["checkout_url"], intent.authorization_url)
                    start.assert_called_once()
                status_path = f"{path}?invoice={invoice.pk}"
                proof = ConfirmedGatewayPayment("paystack", intent.reference, "NGN", amount, str(invoice.pk))
                self.assertFalse(api.post(status_path, {"action": "advance"}, format="json").data["payment_verified"])
                WebhookEvent.objects.create(gateway=self.gateway, is_verified=True, event_type="charge.success",
                    event_id=f"unified-test-{invoice.pk}", payload={"reference": intent.reference,
                    "remote_id": str(invoice.pk), "intent_id": intent.pk})
                with patch("domains.pilot.verify_gateway_intent", return_value=proof):
                    result = api.post(status_path, {"action": "advance"}, format="json")
                self.assertEqual(result.status_code, 200, result.data)
                self.assertTrue(result.data["payment_verified"])
                self.assertEqual(result.data["payment_reference"], intent.reference)
                self.assertEqual(result.data["payment_gateway"], "paystack")
                self.assertIsNotNone(result.data["verified_at"])
                self.assertTrue(all(d["state"] == "test_payment_verified" for d in result.data["domains"]))
                invoice.refresh_from_db()
                self.assertEqual(invoice.status, "void")
                self.assertEqual(invoice.amount_paid, 0)
                from billing.serializers import InvoiceSerializer
                from orders.serializers import OrderSerializer
                self.assertEqual(InvoiceSerializer(invoice).data["payment_reference"], intent.reference)
                self.assertEqual(OrderSerializer(invoice.order).data["payment_reference"], intent.reference)
                self.assertNotEqual(invoice.order.order_number, intent.reference)
                self.assertFalse(Transaction.objects.exists())
                api.force_authenticate(self.owner)
                self.assertEqual(api.get(status_path).status_code, 404)
                api.force_authenticate(customer)
            fourth = api.post(path, {"action": "quote", "domains": [], "services": [service]}, format="json")
            # Per-account mutation throttle may trigger before the fourth order; either is a safe denial.
            if fourth.status_code == 200:
                denied = api.post(path, {"action": "accept", "quote": fourth.data["quote"],
                    "checkout_id": str(uuid4())}, format="json")
                self.assertIn(denied.status_code, (400, 429))
            else:
                self.assertIn(fourth.status_code, (400, 429))
            supplier.assert_not_called()
            single_supplier.assert_not_called()
        self.assertEqual(customer.orders.count(), 3)

    @override_settings(CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=True, CLOUD_HOSTED_CHECKOUT_ENABLED=True,
                       CLOUD_PAYMENT_RETURN_URL="https://console.cloud.octalve.com/client/order/processing")
    def test_pay_now_creates_one_invoice_and_reuses_confirmed_checkout(self):
        from uuid import uuid4
        from billing.models import Invoice
        from payments.hosted_checkout import CheckoutRefused
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar": {
            "connection_id": "fixture", "credential_version": 1, "revision": 2}})
        api = APIClient()
        api.force_authenticate(self.owner)
        path = "/api/domains/combined-cart/"
        with patch("domains.combined_cart.pilot_readiness", return_value=[]), patch.object(
                PaymentGateway, "get_secret_key", return_value="sk_test_example_fixture_0123456789"):
            quote = api.post(path, {"action": "quote", "domains": ["one-click.com"], "services": []}, format="json")
            self.assertEqual(quote.status_code, 200, quote.data)
            self.assertEqual([x["code"] for x in quote.data["gateway_options"] if x["enabled"]], ["paystack"])
            payload = {"action": "pay", "quote": quote.data["quote"], "checkout_id": str(uuid4()),
                       "gateway": "paystack", "consent": True}
            self.assertEqual(api.post(path, {**payload, "consent": False}, format="json").status_code, 400)
            self.assertEqual(api.post(path, {**payload, "gateway": "monnify"}, format="json").status_code, 400)
            self.assertFalse(self.owner.orders.exists())
            # Simulate unavailable gateway before a remote POST. The accepted invoice must remain recoverable.
            with patch("domains.combined_cart.start_cart_payment", side_effect=CheckoutRefused("fixture")):
                failed = api.post(path, payload, format="json")
            self.assertEqual(failed.status_code, 200, failed.data)
            self.assertIn("checkout_error", failed.data)
            self.assertEqual(self.owner.orders.count(), 1)
            invoice_id = failed.data["invoice_id"]
            def send(_url, **kwargs):
                body = kwargs["json"]
                self.assertEqual(body["amount"], "1250000")
                return reply({"status": True, "data": {"reference": body["reference"],
                    "authorization_url": "https://checkout.paystack.com/test_12345"}})
            with patch("payments.hosted_checkout.requests.post", side_effect=send) as post:
                first = api.post(path, payload, format="json")
                second = api.post(path, payload, format="json")
                resumed = api.post(f"{path}?invoice={invoice_id}", {"action": "pay", "gateway": "paystack", "consent": True}, format="json")
                for response in (first, second, resumed):
                    self.assertEqual(response.status_code, 200, response.data)
                    self.assertEqual(response.data["invoice_id"], invoice_id)
                    self.assertEqual(response.data["checkout_url"], "https://checkout.paystack.com/test_12345")
                    self.assertTrue(response.data["payment_started"])
                    self.assertEqual(response.data["payment_attempt_state"], "resumable")
                post.assert_called_once()
            invoice = Invoice.objects.get(pk=invoice_id)
            self.assertEqual(invoice.total, Decimal("12500.00"))
            self.assertEqual(invoice.payment_intents.count(), 1)
            self.assertEqual(self.owner.orders.count(), 1)
            self.assertEqual(invoice.status, "unpaid")
            self.assertFalse(Transaction.objects.exists())

            # A local expiry does not establish provider failure.
            prior=invoice.payment_intents.get()
            invoice.payment_intents.update(expires_at=timezone.now()-timezone.timedelta(minutes=1))
            status = api.get(f"{path}?invoice={invoice_id}")
            self.assertEqual(status.data["payment_attempt_state"], "retry_check")
            for outcome in ("pending", "ongoing", "processing", "reversed", ConfirmedGatewayPayment("paystack", prior.reference, "NGN", invoice.total, "987")):
                with patch("payments.readback.verify_gateway_intent", return_value=outcome), patch("payments.hosted_checkout.requests.post") as no_post:
                    retry = api.post(f"{path}?invoice={invoice_id}", {"action":"pay","gateway":"paystack","consent":True}, format="json")
                    self.assertIn("checkout_error", retry.data)
                    no_post.assert_not_called()
            self.assertEqual(invoice.payment_intents.count(),1)
            with patch("payments.readback.verify_gateway_intent", return_value="abandoned") as verified, patch("payments.hosted_checkout.requests.post", side_effect=send) as post:
                resumed=api.post(f"{path}?invoice={invoice_id}", {"action":"pay","gateway":"paystack","consent":True}, format="json")
                self.assertEqual(resumed.status_code,200,resumed.data)
                self.assertEqual(resumed.data["invoice_id"],invoice_id)
                self.assertEqual(resumed.data["payment_attempt_state"],"resumable")
                self.assertIn("checkout_url",resumed.data)
                verified.assert_called_once()
                repeated=api.post(f"{path}?invoice={invoice_id}", {"action":"pay","gateway":"paystack","consent":True}, format="json")
                self.assertEqual(repeated.data["checkout_url"],resumed.data["checkout_url"])
                post.assert_called_once()
            prior.refresh_from_db()
            self.assertEqual(prior.status,"failed")
            self.assertTrue(prior.metadata["test_retry_superseded"])
            self.assertEqual(prior.metadata["verified_retry_status"],"abandoned")
            self.assertEqual(invoice.payment_intents.count(),2)
            active=invoice.payment_intents.exclude(pk=prior.pk).get()
            self.assertNotEqual(active.reference,prior.reference)
            self.assertEqual(self.owner.orders.count(),1)
            self.assertFalse(Transaction.objects.exists())
            # A late signed success for an earlier test attempt holds the invoice
            # rather than silently accepting another reference.
            WebhookEvent.objects.create(gateway=self.gateway,event_id="late-old-test",event_type="charge.success",is_verified=True,
                payload={"intent_id":prior.pk,"reference":prior.reference,"remote_id":"987"})
            self.assertEqual(api.get(f"{path}?invoice={invoice_id}").data["payment_attempt_state"],"reconciliation_required")
            with patch("payments.hosted_checkout.requests.post") as no_post:
                held=api.post(f"{path}?invoice={invoice_id}", {"action":"pay","gateway":"paystack","consent":True}, format="json")
                self.assertIn("checkout_error",held.data)
                no_post.assert_not_called()
            invoice.refresh_from_db()
            self.assertEqual(invoice.status,"unpaid")
            self.assertFalse(Transaction.objects.exists())

    @override_settings(CLOUD_HOSTED_CHECKOUT_ENABLED=True, CLOUD_PAYMENT_RETURN_URL="https://console.cloud.octalve.com/client/order/processing")
    def test_legacy_invoice_pay_now_requires_consent_and_recovers_test_only(self):
        from payments.hosted_checkout import payment_attempt_summary
        order=accept_quote(self.owner,self.domain,self.token)
        invoice=order.invoices.get()
        prior=PaymentIntent.objects.create(invoice=invoice,client=self.owner,gateway=self.gateway,
            reference="OC"+"A"*30,amount=invoice.total,currency="NGN",status="pending",
            expires_at=timezone.now()-timezone.timedelta(minutes=1),
            authorization_url="https://checkout.paystack.com/test_12345",metadata={"checkout_state":"confirmed"})
        api=APIClient()
        api.force_authenticate(self.owner)
        path=f"/api/domains/sandbox-purchase/?invoice={invoice.pk}"
        with patch("domains.combined_cart.pilot_readiness",return_value=[]), patch.object(PaymentGateway,"get_secret_key",return_value="sk_test_example_fixture_0123456789"):
            state=api.get(path)
            self.assertEqual(state.data["purchase"]["checkout_state"],"retry_check")
            self.assertTrue(state.data["purchase"]["gateway_options"][0]["enabled"])
            with patch("payments.hosted_checkout.requests.post") as no_post:
                self.assertEqual(api.post(path,{"action":"checkout","gateway":"paystack"},format="json").status_code,400)
                self.assertEqual(api.post(path,{"action":"checkout","gateway":"flutterwave","consent":True},format="json").status_code,400)
                no_post.assert_not_called()
            def send(_url,**kwargs):
                return reply({"status":True,"data":{"reference":kwargs["json"]["reference"],"authorization_url":"https://checkout.paystack.com/test_12345"}})
            with patch("payments.readback.verify_gateway_intent",side_effect=PaymentReadbackRejected("fixture")), patch("payments.hosted_checkout.requests.post") as no_post:
                self.assertEqual(api.post(path,{"action":"checkout","gateway":"paystack","consent":True},format="json").status_code,409)
                no_post.assert_not_called()
            with patch("payments.readback.verify_gateway_intent",return_value="failed"), patch("payments.hosted_checkout.requests.post",side_effect=send) as post:
                response=api.post(path,{"action":"checkout","gateway":"paystack","consent":True},format="json")
                self.assertEqual(response.status_code,200,response.data)
                post.assert_called_once()
        self.assertEqual(invoice.payment_intents.count(),2)
        self.assertEqual(self.owner.orders.count(),1)
        self.assertEqual(payment_attempt_summary(invoice)["state"],"resumable")
        self.supplier.submit_pilot_registration.assert_not_called()
        self.assertFalse(Transaction.objects.exists())

    def test_approved_worker_only_advances_exact_private_order_and_never_resubmits(self):
        from domains.sandbox_fulfillment import advance_approved_order
        order = accept_quote(self.owner, self.domain, self.token)
        invoice = order.invoices.get()
        intent = PaymentIntent.objects.create(
            invoice=invoice, client=self.owner, gateway=self.gateway, reference="OC-AUTO-TEST",
            amount=invoice.total, currency="NGN", status="pending",
            expires_at=timezone.now() + timezone.timedelta(minutes=10),
        )
        with patch.dict("os.environ", {"CLOUD_REGISTRAR_SANDBOX_AUTOMATION_ENABLED": "true",
                                     "CLOUD_REGISTRAR_SANDBOX_ORDER_ID": str(order.public_id)}):
            self.assertEqual(advance_approved_order(), "waiting_payment")
            self.supplier.submit_pilot_registration.assert_not_called()
            WebhookEvent.objects.create(
                gateway=self.gateway, is_verified=True, event_type="charge.success", event_id="worker-test",
                payload={"reference": intent.reference, "remote_id": "123", "intent_id": intent.pk},
            )
            proof = ConfirmedGatewayPayment("paystack", intent.reference, "NGN", invoice.total, "123")
            self.supplier.submit_pilot_registration.side_effect = CloudflareINT01Denied
            with patch("domains.pilot.verify_gateway_intent", return_value=proof):
                self.assertEqual(advance_approved_order(), "advanced")
            order.refresh_from_db()
            self.assertEqual(order.metadata[PILOT]["state"], "registration_uncertain")
            self.assertTrue(WebhookEvent.objects.get().is_processed)
            self.supplier.pilot_registration_status.return_value = {"state": "succeeded"}
            self.supplier.get_registration.return_value = {
                "domain_name": self.domain, "sandbox_status": "active",
                "registered_at": "2026-11-22T12:00:00+00:00", "expires_at": "2027-11-22T12:00:00+00:00",
            }
            self.assertEqual(advance_approved_order(), "advanced")
            self.assertEqual(advance_approved_order(), "idle")
            self.supplier.submit_pilot_registration.assert_called_once()
            order.refresh_from_db()
            self.assertEqual(order.metadata[PILOT]["state"], "registered")
            invoice.refresh_from_db()
            self.assertEqual(invoice.status, "void")
            self.assertFalse(Transaction.objects.exists())

    def test_approved_worker_rejects_public_orders_missing_or_invalid_pin(self):
        from domains.sandbox_fulfillment import advance_approved_order
        order = accept_quote(self.owner, self.domain, self.token)
        order.metadata[PILOT]["public_payment_test"] = True
        order.save(update_fields=["metadata"])
        with patch.dict("os.environ", {"CLOUD_REGISTRAR_SANDBOX_AUTOMATION_ENABLED": "false",
                                     "CLOUD_REGISTRAR_SANDBOX_ORDER_ID": str(order.public_id)}):
            self.assertEqual(advance_approved_order(), "disabled")
        with patch.dict("os.environ", {"CLOUD_REGISTRAR_SANDBOX_AUTOMATION_ENABLED": "true",
                                     "CLOUD_REGISTRAR_SANDBOX_ORDER_ID": "not-a-uuid"}):
            self.assertEqual(advance_approved_order(), "disabled")
        with patch.dict("os.environ", {"CLOUD_REGISTRAR_SANDBOX_AUTOMATION_ENABLED": "true",
                                     "CLOUD_REGISTRAR_SANDBOX_ORDER_ID": str(order.public_id)}):
            self.assertEqual(advance_approved_order(), "held")
        self.supplier.submit_pilot_registration.assert_not_called()

    def test_private_claim_guard_across_orders_ignores_public_fixtures(self):
        from django.db import transaction
        from rest_framework.exceptions import ValidationError
        from domains.sandbox_fulfillment import assert_private_domain_unclaimed
        order = accept_quote(self.owner, self.domain, self.token)
        with transaction.atomic():
            with self.assertRaises(ValidationError):
                assert_private_domain_unclaimed([self.domain])
            assert_private_domain_unclaimed([self.domain], order_id=order.pk)
        order.metadata[PILOT]["public_payment_test"] = True
        order.save(update_fields=["metadata"])
        with transaction.atomic():
            assert_private_domain_unclaimed([self.domain])

    @override_settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=True)
    def test_private_multi_year_quote_is_published_rate_and_supplier_bound(self):
        from domains.pilot import quote_domain
        from rest_framework.exceptions import ValidationError
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar":{"revision":1}})
        self.supplier.check.return_value={"name":self.domain,"registrable":True,
            "currency":"USD","registration_cost":"10.00","renewal_cost":"11.00"}
        self.supplier.supported_registration_terms.return_value=[1,2,5]
        with patch("domains.pilot.query_published_registrar",return_value={"registrable":True}):
            quoted=quote_domain(self.owner.pk,self.domain,selected=True,years=2)
            self.assertEqual(Decimal(quoted["amount"]),Decimal("26000"))
            self.assertEqual(quoted["years"],2)
            with self.assertRaises(ValidationError):
                quote_domain(self.owner.pk,self.domain,selected=True,years=10)
            with self.assertRaises(ValidationError):
                quote_domain(self.owner.pk,self.domain,selected=True,public_payment_test=True,years=2)
        order=accept_quote(self.owner,self.domain,quoted["quote"],selected=True)
        self.assertEqual(order.items.get().months,24)
        self.assertEqual(order.invoices.get().total,Decimal("26000"))
        self.supplier.submit_pilot_registration.assert_not_called()

    @override_settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=True)
    def test_private_multi_year_supplier_post_exact_term_and_confirmation(self):
        from domains.pilot import quote_domain
        TLDPricing.objects.filter(tld=".com").update(metadata={"published_registrar":{"revision":1}})
        self.supplier.check.return_value={"name":self.domain,"registrable":True,
            "currency":"USD","registration_cost":"10.00","renewal_cost":"11.00"}
        self.supplier.supported_registration_terms.return_value=[1,2,5]
        with patch("domains.pilot.query_published_registrar",return_value={"registrable":True}):
            quoted=quote_domain(self.owner.pk,self.domain,selected=True,years=2)
        order=accept_quote(self.owner,self.domain,quoted["quote"],selected=True)
        invoice=order.invoices.get()
        intent=PaymentIntent.objects.create(invoice=invoice,client=self.owner,gateway=self.gateway,
            reference="OC-MULTI-YEAR",status="pending",amount=invoice.total,currency="NGN",
            expires_at=timezone.now()+timezone.timedelta(minutes=5))
        WebhookEvent.objects.create(gateway=self.gateway,is_verified=True,event_type="charge.success",event_id="multi-year",
            payload={"intent_id":intent.pk,"reference":intent.reference,"remote_id":"456"})
        transport=Mock(side_effect=[
            {"success":True,"result":{"metadata":{"name":"com","tld":"com"},"registration_schema":{"properties":{"years":{"minimum":1,"maximum":10}}}}},
            {"success":True,"result":{"state":"succeeded","completed":True}},
        ])
        self.supplier.submit_pilot_registration.side_effect=CloudflareINT01("a"*32,transport).submit_pilot_registration
        self.supplier.get_registration.return_value={"domain_name":self.domain,"sandbox_status":"active",
            "registered_at":"2026-11-27T12:00:00Z","expires_at":"2028-11-27T12:00:00Z"}
        proof=ConfirmedGatewayPayment("paystack",intent.reference,"NGN",invoice.total,"456")
        with patch("domains.pilot.verify_gateway_intent",return_value=proof):
            reconcile(order)
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"],"registered")
        self.assertEqual(transport.call_args_list[-1].args[0],"POST")
        self.assertEqual(transport.call_args_list[-1].args[2]["years"],2)
        self.assertFalse(transport.call_args_list[-1].args[2]["auto_renew"])
        self.assertFalse(Transaction.objects.exists())


    @override_settings(CLOUD_TEST_LIFECYCLE_ENABLED=True,CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=True,
                       CLOUD_GATEWAY_READBACK_ENABLED=True,CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True)
    def test_private_pilot_payment_automatically_reconciles_even_without_supplier(self):
        from payments.automatic_reconciliation import attempt_event
        order=accept_quote(self.owner,self.domain,self.token)
        invoice=order.invoices.get()
        intent=PaymentIntent.objects.create(invoice=invoice,client=self.owner,gateway=self.gateway,
            reference="OC-AUTO-DEFERRED",status="pending",amount=invoice.total,currency="NGN",
            expires_at=timezone.now()+timezone.timedelta(minutes=10))
        event=WebhookEvent.objects.create(gateway=self.gateway,is_verified=True,event_type="charge.success",
            event_id="automatic-deferred-test",payload={"intent_id":intent.pk,"reference":intent.reference,
            "remote_id":"123"})
        proof=ConfirmedGatewayPayment("paystack",intent.reference,"NGN",invoice.total,"123")
        with patch("domains.pilot.registrar",side_effect=CloudflareINT01Denied()) as registrar,patch(
                "domains.pilot.verify_gateway_intent",return_value=proof) as readback:
            self.assertEqual(attempt_event(event.pk),"processed")
            self.assertEqual(attempt_event(event.pk),"processed")
            registrar.assert_not_called()
            readback.assert_called_once()
        order.refresh_from_db()
        invoice.refresh_from_db()
        intent.refresh_from_db()
        self.assertEqual(invoice.status,"void")
        self.assertEqual(intent.status,"completed")
        self.assertEqual(order.metadata[PILOT]["state"],"registration_pending")
        self.assertTrue(order.metadata[PILOT]["payment_only_pending_submission"])
        self.assertFalse(order.metadata[PILOT]["sandbox_submission_reserved"])
        self.supplier.check.return_value={"registrable":True}
        self.supplier.submit_pilot_registration.side_effect=CloudflareINT01Denied()
        reconcile(order)
        order.refresh_from_db()
        self.assertTrue(order.metadata[PILOT]["sandbox_submission_reserved"])
        self.assertNotIn("payment_only_pending_submission",order.metadata[PILOT])
        self.supplier.pilot_registration_status.return_value={"state":"succeeded"}
        self.supplier.get_registration.return_value={"domain_name":self.domain,"sandbox_status":"active",
            "registered_at":"2026-11-27T12:00:00Z","expires_at":"2027-11-27T12:00:00Z"}
        reconcile(order)
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"],"registered")
        self.supplier.submit_pilot_registration.assert_called_once()
        self.assertFalse(Transaction.objects.exists())


    @override_settings(CLOUD_TEST_LIFECYCLE_ENABLED=True,CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=True,
                       CLOUD_GATEWAY_READBACK_ENABLED=True,CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True)
    def test_queue_automatically_selects_verified_private_order_without_uuid_pin(self):
        from domains.sandbox_fulfillment import advance_due_orders
        from payments.automatic_reconciliation import attempt_event
        order=accept_quote(self.owner,self.domain,self.token)
        invoice=order.invoices.get()
        intent=PaymentIntent.objects.create(invoice=invoice,client=self.owner,gateway=self.gateway,
            reference="OC-QUEUE-PRIVATE",status="pending",amount=invoice.total,currency="NGN",
            expires_at=timezone.now()+timezone.timedelta(minutes=10))
        event=WebhookEvent.objects.create(gateway=self.gateway,is_verified=True,event_type="charge.success",
            event_id="queue-test",payload={"intent_id":intent.pk,"reference":intent.reference,"remote_id":"123"})
        proof=ConfirmedGatewayPayment("paystack",intent.reference,"NGN",invoice.total,"123")
        with patch.dict("os.environ",{"CLOUD_REGISTRAR_SANDBOX_QUEUE_ENABLED":"true",
                                     "CLOUD_REGISTRAR_SANDBOX_ORDER_ID":""}):
            self.assertEqual(advance_due_orders(),"idle")
            with patch("domains.pilot.verify_gateway_intent",return_value=proof):
                self.assertEqual(attempt_event(event.pk),"processed")
            self.supplier.check.return_value={"registrable":True}
            self.supplier.submit_pilot_registration.side_effect=CloudflareINT01Denied()
            self.assertEqual(advance_due_orders(),"advanced")
            self.supplier.pilot_registration_status.return_value={"state":"succeeded"}
            self.supplier.get_registration.return_value={"domain_name":self.domain,"sandbox_status":"active",
                "registered_at":"2026-11-27T12:00:00Z","expires_at":"2027-11-27T12:00:00Z"}
            self.assertEqual(advance_due_orders(),"advanced")
            self.assertEqual(advance_due_orders(),"idle")
            self.supplier.submit_pilot_registration.assert_called_once()
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"],"registered")
        self.assertFalse(Transaction.objects.exists())
