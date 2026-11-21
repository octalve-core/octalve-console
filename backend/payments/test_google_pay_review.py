"""Review-only Google Pay surface; no gateway charge or settlement occurs."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import Invoice
from payments.models import PaymentGateway, PaymentIntent, Transaction


class GooglePayReviewTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email="googlepay-owner@example.test",
            username="googlepayowner",
            password="fixture-not-production",
            role="client",
        )
        self.stranger = get_user_model().objects.create_user(
            email="googlepay-stranger@example.test",
            username="googlepaystranger",
            password="fixture-not-production",
            role="client",
        )
        self.invoice = Invoice.objects.create(
            client=self.owner,
            currency="NGN",
            subtotal=Decimal("12500.00"),
            total=Decimal("12500.00"),
            due_date=timezone.now() + timedelta(days=7),
        )
        PaymentGateway.objects.create(
            code="paystack",
            name="Paystack",
            status="active",
            test_mode=False,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.url = reverse("google-pay-review-config")

    def test_disabled_by_default_and_creates_no_payment_authority(self):
        response = self.client.get(self.url, {"invoice_id": self.invoice.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"enabled": False, "review_only": True, "charge_enabled": False},
        )
        self.assertFalse(PaymentIntent.objects.exists())
        self.assertFalse(Transaction.objects.exists())

    @override_settings(
        CLOUD_GOOGLE_PAY_REVIEW_ENABLED=True,
        CLOUD_GOOGLE_PAY_CHARGE_ENABLED=False,
        CLOUD_GOOGLE_PAY_MERCHANT_NAME="Octalve Cloud",
        CLOUD_GOOGLE_PAY_MERCHANT_ID="BCR2DN7TTCZK3ED6",
        CLOUD_PAYSTACK_INTEGRATION_ID="1234567",
    )
    def test_exact_owned_unpaid_invoice_returns_only_non_secret_test_config(self):
        response = self.client.get(self.url, {"invoice_id": self.invoice.pk})
        self.assertEqual(response.status_code, 200)
        body = response.json()

        self.assertTrue(body["enabled"])
        self.assertTrue(body["review_only"])
        self.assertFalse(body["charge_enabled"])
        self.assertEqual(body["environment"], "TEST")
        self.assertEqual(body["processor"], "paystack")
        self.assertEqual(
            body["allowed_auth_methods"],
            ["CRYPTOGRAM_3DS", "PAN_ONLY"],
        )
        self.assertEqual(body["allowed_card_networks"], ["VISA", "MASTERCARD"])
        self.assertEqual(body["transaction_info"]["currencyCode"], "NGN")
        self.assertEqual(body["transaction_info"]["totalPrice"], "12500.00")
        self.assertEqual(
            body["tokenization"]["parameters"]["gatewayMerchantId"],
            "1234567",
        )
        self.assertEqual(
            body["merchant_info"]["merchantId"],
            "BCR2DN7TTCZK3ED6",
        )
        serialized = str(body).lower()
        self.assertNotIn("secret", serialized)
        self.assertNotIn("authorization_url", serialized)
        self.assertNotIn("access_code", serialized)
        self.assertFalse(PaymentIntent.objects.exists())
        self.assertFalse(Transaction.objects.exists())

    @override_settings(
        CLOUD_GOOGLE_PAY_REVIEW_ENABLED=True,
        CLOUD_GOOGLE_PAY_CHARGE_ENABLED=False,
        CLOUD_GOOGLE_PAY_MERCHANT_NAME="Octalve Cloud",
        CLOUD_PAYSTACK_INTEGRATION_ID="1234567",
    )
    def test_merchant_id_is_optional_for_google_test_review(self):
        response = self.client.get(self.url, {"invoice_id": self.invoice.pk})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("merchantId", response.json()["merchant_info"])

    @override_settings(
        CLOUD_GOOGLE_PAY_REVIEW_ENABLED=True,
        CLOUD_GOOGLE_PAY_CHARGE_ENABLED=False,
        CLOUD_GOOGLE_PAY_MERCHANT_NAME="Octalve Cloud",
        CLOUD_PAYSTACK_INTEGRATION_ID="1234567",
    )
    def test_other_customer_cannot_probe_invoice_or_configuration(self):
        self.client.force_authenticate(self.stranger)
        response = self.client.get(self.url, {"invoice_id": self.invoice.pk})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"enabled": False, "review_only": True, "charge_enabled": False},
        )

    @override_settings(
        CLOUD_GOOGLE_PAY_REVIEW_ENABLED=True,
        CLOUD_GOOGLE_PAY_CHARGE_ENABLED=False,
        CLOUD_GOOGLE_PAY_MERCHANT_NAME="Octalve Cloud",
        CLOUD_PAYSTACK_INTEGRATION_ID="1234567",
    )
    def test_paid_or_partially_changed_invoice_is_refused(self):
        self.invoice.amount_paid = Decimal("100.00")
        self.invoice.save(update_fields=["amount_paid"])
        response = self.client.get(self.url, {"invoice_id": self.invoice.pk})
        self.assertEqual(response.status_code, 409)

    @override_settings(
        CLOUD_GOOGLE_PAY_REVIEW_ENABLED=True,
        CLOUD_GOOGLE_PAY_CHARGE_ENABLED=True,
        CLOUD_GOOGLE_PAY_MERCHANT_NAME="Octalve Cloud",
        CLOUD_PAYSTACK_INTEGRATION_ID="1234567",
    )
    def test_future_charge_flag_fails_closed_until_charge_contract_exists(self):
        response = self.client.get(self.url, {"invoice_id": self.invoice.pk})
        self.assertEqual(response.status_code, 409)
        self.assertFalse(PaymentIntent.objects.exists())
        self.assertFalse(Transaction.objects.exists())
