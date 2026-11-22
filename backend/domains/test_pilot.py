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
            username="pilot", email="pilot@example.test", role="client",
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
        self.assertFalse(invoice_data["payment_action_allowed"])
        self.assertTrue(gateway_can_read(self.gateway, invoice))
        def send(_url, **kwargs):
            body = kwargs["json"]
            self.assertEqual(body["callback_url"],
                             "https://console.example.test/client/order/checkout?product=domain&domain=selected-by-customer.com")
            return reply({"status": True, "data": {"reference": body["reference"],
                         "authorization_url": "https://checkout.paystack.com/test_12345"}})

        with self.settings(CLOUD_HOSTED_CHECKOUT_ENABLED=True, CLOUD_PAYMENT_RETURN_URL="https://console.example.test/client/order/processing"), patch.object(
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
            for change in ({"domain": "live"}, {"amount": 1250001}, {"reference": "another_ref"}):
                altered = {**packet, "data": {**packet["data"], **change}}
                with self.assertRaises(PaymentReadbackRejected):
                    verify_gateway_intent(intent, getter=Mock(return_value=reply(altered)), inspect_pilot=True)
        self.supplier.submit_pilot_registration.assert_not_called()

    def test_preflight_explains_missing_gateway_and_contact(self):
        with patch.dict("os.environ", {"CLOUD_DOMAIN_PILOT_CONTACT_JSON": "{}"}):
            issues = pilot_readiness(self.owner.pk)
        self.assertIn("Configure the sandbox registrant contact on the API.", issues)
        self.assertIn("Bind a currently verified Paystack Test Mode connection.", issues)
