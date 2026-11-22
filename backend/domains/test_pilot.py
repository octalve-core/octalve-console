import json
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase
from django.utils import timezone

from domains.pilot import QUOTE_SALT, accept_quote, reconcile
from domains.models import TLDPricing
from payments.domain_pilot_scope import PILOT
from payments.models import PaymentGateway, PaymentIntent, Transaction, WebhookEvent
from payments.readback import ConfirmedGatewayPayment
from payments.sandbox import gateway_can_read
from providers.cloudflare_int01 import CloudflareINT01Denied


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

    def test_timeout_never_resubmits_and_success_never_posts_revenue(self):
        order = accept_quote(self.owner, self.domain, self.token)
        invoice = order.invoices.get()
        intent = PaymentIntent.objects.create(
            invoice=invoice, client=self.owner, gateway=self.gateway, reference="OC-PILOT-TEST",
            amount=invoice.total, currency="NGN", status="pending",
            expires_at=timezone.now() + timezone.timedelta(minutes=20),
        )
        WebhookEvent.objects.create(
            gateway=self.gateway, is_verified=True, event_type="charge.success", event_id="pilot-test",
            payload={"reference": intent.reference, "remote_id": "123", "intent_id": intent.pk},
        )
        self.supplier.submit_pilot_registration.side_effect = CloudflareINT01Denied
        proof = ConfirmedGatewayPayment("paystack", intent.reference, "NGN", Decimal("12500.00"), "123")
        with patch("domains.pilot.verify_gateway_intent", return_value=proof):
            with self.assertRaises(CloudflareINT01Denied):
                reconcile(order)
        order.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"], "registration_pending")
        self.supplier.get_registration.return_value = {"domain_name": self.domain, "sandbox_status": "active"}
        reconcile(order)
        order.refresh_from_db()
        invoice.refresh_from_db()
        self.assertEqual(order.metadata[PILOT]["state"], "registered")
        self.assertEqual(invoice.status, "void")
        self.assertFalse(Transaction.objects.exists())
        self.supplier.submit_pilot_registration.assert_called_once()
