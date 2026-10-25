"""No live payment: HTTP gateway replies and signed notification fixtures only."""
import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import Invoice
from orders.models import Order
from payments.hosted_checkout import reserve_hosted_checkout, CheckoutRefused
from payments.webhook_inbox import accept_signed_event, WebhookRejected
from payments.models import PaymentGateway, PaymentIntent, Transaction, WebhookEvent
from services.models import Service


def reply(packet, *, status=200):
    obj = Mock(status_code=status, headers={})
    obj.raw.read.return_value = json.dumps(packet).encode()
    return obj


@override_settings(CLOUD_HOSTED_CHECKOUT_ENABLED=True,
                   CLOUD_PAYMENT_RETURN_URL="https://console.octalve.example/payments/return/")
class CheckoutAndWebhookTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email="hosted-review@example.test", username="hostedreview",
            password="fixture-not-production", role="client")
        self.stranger = get_user_model().objects.create_user(
            email="stranger-hosted@example.test", username="hostedstranger",
            password="fixture-not-production", role="client")
        self.order = Order.objects.create(
            client=self.owner, status="pending_payment", currency="NGN",
            total=Decimal("3500.00"), subtotal=Decimal("3500.00"),
        )
        self.invoice = Invoice.objects.create(
            client=self.owner, order=self.order, currency="NGN",
            total=Decimal("3500.00"), subtotal=Decimal("3500.00"),
            due_date=timezone.now()+timedelta(days=7),
        )
        self.paystack = PaymentGateway.objects.create(
            code="paystack", name="Review Paystack", test_mode=False,
            status="active")
        self.flutterwave = PaymentGateway.objects.create(
            code="flutterwave", name="Review Flutterwave",
            status="active", test_mode=False)
        self.credential = patch.object(
            PaymentGateway, "get_secret_key", return_value="sk_live_fake_test_fixtures_only_0123456")
        self.credential.start()
        self.addCleanup(self.credential.stop)

    def paystack_reply(self, ref, **changes):
        data = {"authorization_url": "https://checkout.paystack.com/test_12345",
                "reference": ref, "access_code": "not-required"}
        data.update(changes)
        return reply({"status": True, "data": data})

    def test_gateway_reservation_exact_amount_url_and_idempotency(self):
        # Provider response must echo the unknown server-side reference.
        def send(_url, **kw):
            self.assertEqual(_url, "https://api.paystack.co/transaction/initialize")
            self.assertEqual(kw["json"]["email"], self.owner.email)
            self.assertEqual(kw["json"]["amount"], "350000")
            self.assertEqual(kw["json"]["currency"], "NGN")
            self.assertEqual(kw["json"]["callback_url"],
                             "https://console.octalve.example/payments/return/")
            self.assertTrue(kw["verify"])
            self.assertFalse(kw["allow_redirects"])
            self.assertTrue(kw["stream"])
            return self.paystack_reply(kw["json"]["reference"])
        post = Mock(side_effect=send)
        attempt, created = reserve_hosted_checkout(
            self.invoice.pk, "paystack", poster=post)
        self.assertTrue(created)
        self.assertEqual(attempt.status, "pending")
        self.assertEqual(attempt.metadata["checkout_state"], "confirmed")
        self.assertEqual(attempt.authorization_url,
                         "https://checkout.paystack.com/test_12345")
        second, created_again = reserve_hosted_checkout(
            self.invoice.pk, "paystack", poster=post)
        self.assertFalse(created_again)
        self.assertEqual(attempt.pk, second.pk)
        self.assertEqual(post.call_count, 1)
        self.assertEqual(PaymentIntent.objects.count(), 1)
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertFalse(Transaction.objects.exists())
        self.assertFalse(Service.objects.exists())

    def test_flutterwave_exact_reference_and_preapproved_host(self):
        post = Mock(side_effect=lambda _url, **kw: reply({
            "status": "success",
            "data": {"link": "https://checkout.flutterwave.com/v3/hosted/pay/review_link"}}))
        intent, created = reserve_hosted_checkout(self.invoice.pk,
                                                  "flutterwave", poster=post)
        self.assertTrue(created)
        self.assertIn("tx_ref", post.call_args.kwargs["json"])
        self.assertEqual(post.call_args.kwargs["json"]["amount"], "3500.00")
        self.assertEqual(post.call_args.kwargs["json"]["customer"]["email"], self.owner.email)
        self.assertEqual(intent.authorization_url,
                         "https://checkout.flutterwave.com/v3/hosted/pay/review_link")

    def test_uncertain_post_stays_reserved_and_never_blind_retries(self):
        from requests import Timeout
        post = Mock(side_effect=Timeout())
        with self.assertRaises(CheckoutRefused):
            reserve_hosted_checkout(self.invoice.pk, "paystack", poster=post)
        pending = PaymentIntent.objects.get(invoice=self.invoice)
        self.assertEqual(pending.status, "processing")
        self.assertEqual(pending.metadata["checkout_state"], "reserved")
        with self.assertRaises(CheckoutRefused):
            reserve_hosted_checkout(self.invoice.pk, "paystack", poster=post)
        with self.assertRaises(CheckoutRefused):
            reserve_hosted_checkout(self.invoice.pk, "flutterwave", poster=post)
        self.assertEqual(post.call_count, 1)

    def test_malicious_external_checkout_link_rejected_and_not_exposed(self):
        for bad in ("http://checkout.paystack.com/path",
                    "https://checkout.paystack.com.evil.test/path",
                    "https://checkout.paystack.com@evil.test/path",
                    "https://127.0.0.1/path",
                    "https://checkout.paystack.com/",
                    "https://checkout.paystack.com/fake?next=evil"):
            with self.subTest(url=bad):
                # New invoice isolated per attempt.
                with self.assertRaises(CheckoutRefused):
                    reserve_hosted_checkout(
                        self.invoice.pk, "paystack",
                        poster=Mock(side_effect=lambda _url, **kw:
                                    self.paystack_reply(kw["json"]["reference"],
                                                       authorization_url=bad)))
                self.assertFalse(PaymentIntent.objects.exclude(
                    authorization_url__isnull=True).exclude(authorization_url="").exists())
                PaymentIntent.objects.all().delete()

    def test_disabled_and_ineligible_invoice_do_not_call_gateway(self):
        post = Mock()
        with override_settings(CLOUD_HOSTED_CHECKOUT_ENABLED=False):
            with self.assertRaises(CheckoutRefused):
                reserve_hosted_checkout(self.invoice.pk, "paystack", poster=post)
        self.invoice.status = "paid"
        self.invoice.save(update_fields=["status"])
        with self.assertRaises(CheckoutRefused):
            reserve_hosted_checkout(self.invoice.pk, "paystack", poster=post)
        post.assert_not_called()

    @override_settings(CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True)
    def test_signature_verified_webhook_stored_only_minimal_once(self):
        # A signed webhook on its own MUST NOT create a paid transaction.
        attempt = PaymentIntent.objects.create(
            invoice=self.invoice, client=self.owner, gateway=self.paystack,
            reference="OC" + "A" * 30,
            amount=self.invoice.total, currency="NGN", status="pending",
            expires_at=timezone.now()+timedelta(minutes=30),
        )
        body = json.dumps({"event": "charge.success",
                           "data": {"id": 12345, "reference": attempt.reference,
                                    "authorization": {"authorization_code": "DO_NOT_STORE"},
                                    "customer": {"email": "PRIVATE@EXAMPLE.TEST"}}}).encode()
        key = "fixture-paystack-private-secret"
        with patch.object(PaymentGateway, "get_secret_key", return_value=key):
            signature = hmac.new(key.encode(), body, hashlib.sha512).hexdigest()
            one, created = accept_signed_event(
                "paystack", body, {"X-Paystack-Signature": signature})
            two, again = accept_signed_event(
                "paystack", body, {"X-Paystack-Signature": signature})
        self.assertTrue(created)
        self.assertFalse(again)
        self.assertEqual(one.pk, two.pk)
        self.assertEqual(WebhookEvent.objects.count(), 1)
        event = WebhookEvent.objects.get()
        self.assertTrue(event.is_verified)
        self.assertFalse(event.is_processed)
        self.assertNotIn("DO_NOT_STORE", str(event.payload))
        self.assertNotIn("PRIVATE@EXAMPLE.TEST", str(event.payload))
        self.assertEqual(event.headers, {})
        self.assertFalse(Transaction.objects.exists())
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertFalse(Service.objects.exists())

    @override_settings(CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True)
    def test_wrong_signature_or_unknown_provider_event_no_persistence(self):
        fake = json.dumps({"event": "charge.success",
                           "data": {"id": 123, "reference": "OC" + "A" * 30}}).encode()
        with self.assertRaises(WebhookRejected):
            accept_signed_event("paystack", fake,
                                {"X-Paystack-Signature": "forged"})
        self.assertFalse(WebhookEvent.objects.exists())
        payload = {"event": "charge.completed",
                   "data": {"id": 345, "tx_ref": "OTHER_REF", "status": "successful"}}
        with patch.object(PaymentGateway, "get_webhook_secret", return_value="trusted-only"):
            event, created = accept_signed_event(
                "flutterwave", json.dumps(payload).encode(),
                {"Verif-Hash": "trusted-only"})
        self.assertIsNone(event)
        self.assertFalse(created)
        self.assertFalse(WebhookEvent.objects.exists())

    def test_public_webhook_disabled_by_default(self):
        api = APIClient()
        packet = {"event": "charge.success", "data": {"id": 99, "reference": "X" * 30}}
        response = api.post("/api/payments/webhook/paystack/", packet, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertFalse(WebhookEvent.objects.exists())

    @override_settings(CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True)
    def test_public_webhook_never_settles_billing_even_with_signed_event(self):
        attempt = PaymentIntent.objects.create(
            invoice=self.invoice, client=self.owner, gateway=self.paystack,
            reference="OC" + "C" * 30, amount=self.invoice.total,
            expires_at=timezone.now()+timedelta(minutes=30))
        payload = {"event": "charge.success",
                   "data": {"id": 101, "reference": attempt.reference}}
        raw = json.dumps(payload).encode()
        sig_key = "secret-to-verify-review-event"
        sig = hmac.new(sig_key.encode(), raw, hashlib.sha512).hexdigest()
        with patch.object(PaymentGateway, "get_secret_key", return_value=sig_key):
            reply = APIClient().generic("POST", "/api/payments/webhook/paystack/",
                                       raw, content_type="application/json",
                                       HTTP_X_PAYSTACK_SIGNATURE=sig)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(WebhookEvent.objects.count(), 1)
        self.assertEqual(Transaction.objects.count(), 0)
        self.assertEqual(Service.objects.count(), 0)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")

    @override_settings(CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED=True)
    def test_checkout_api_denies_foreign_invoice_and_browser_amount_injection(self):
        api = APIClient()
        api.force_authenticate(self.stranger)
        with patch("payments.hosted_checkout.requests.post") as post:
            result = api.post("/api/payments/initialize/", {
                "invoice_id": self.invoice.pk, "gateway": "paystack",
            }, format="json")
        self.assertEqual(result.status_code, 404)
        post.assert_not_called()
        api.force_authenticate(self.owner)
        with patch("payments.hosted_checkout.requests.post") as post:
            result = api.post("/api/payments/initialize/", {
                "invoice_id": self.invoice.pk, "gateway": "paystack",
                "amount": "1.00",
            }, format="json")
        self.assertEqual(result.status_code, 400)
        post.assert_not_called()
        self.assertFalse(PaymentIntent.objects.exists())

    @override_settings(CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED=True)
    def test_checkout_api_returns_only_server_verified_hosted_url(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        with patch("payments.hosted_checkout.requests.post", side_effect=lambda _url, **kwargs:
                   self.paystack_reply(kwargs["json"]["reference"])) as post:
            first = api.post("/api/payments/initialize/", {
                "invoice_id": self.invoice.pk, "gateway": "paystack",
            }, format="json")
            repeat = api.post("/api/payments/initialize/", {
                "invoice_id": self.invoice.pk, "gateway": "paystack",
            }, format="json")
        self.assertEqual(first.status_code, 201, getattr(first, "data", {}))
        self.assertEqual(repeat.status_code, 200)
        self.assertEqual(post.call_count, 1)
        self.assertEqual(first.data["checkout_url"], repeat.data["checkout_url"])
        self.assertEqual(first.data["checkout_url"],
                         "https://checkout.paystack.com/test_12345")
        self.assertNotIn("sk_live", str(first.data))
        self.assertNotIn("amount", first.data)

    @override_settings(CLOUD_PAYMENT_STATUS_HTTP_ENABLED=True)
    def test_return_status_is_owner_scoped_and_ignores_gateway_success_query(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        answer = api.get(
            f"/api/payments/verify/?invoice_id={self.invoice.pk}&status=successful&tx_ref=FAKE")
        self.assertEqual(answer.status_code, 200)
        self.assertEqual(answer.data["invoice_status"], "unpaid")
        self.assertNotIn("transaction_reference", answer.data)
        api.force_authenticate(self.stranger)
        answer = api.get(f"/api/payments/verify/?invoice_id={self.invoice.pk}")
        self.assertEqual(answer.status_code, 404)

    def test_disabled_checkout_and_status_endpoints_are_not_payment_shortcuts(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        self.assertEqual(api.post("/api/payments/initialize/", {
            "invoice_id": self.invoice.pk, "gateway": "paystack"}, format="json").status_code, 503)
        self.assertEqual(api.get(
            f"/api/payments/verify/?invoice_id={self.invoice.pk}").status_code, 503)
        self.assertFalse(Transaction.objects.exists())
