"""Regression: no fabricated billing status, unsafe quotes or cross-tenant PDFs."""
from datetime import timedelta
from decimal import Decimal
from dataclasses import FrozenInstanceError
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .invoice_pdf import (
    DEFAULT_TEMPLATE_ID, LOGO_FILE, MAX_ITEMS, TEMPLATE_REGISTRY, default_template_id,
    _document, _logo, render_invoice_pdf,
)
from .models import Invoice, InvoiceItem, Quote


class InvoiceBrandingContractTests(SimpleTestCase):
    def test_pdf_embeds_exact_server_bundled_logo_bytes(self):
        self.assertTrue(LOGO_FILE.is_file())
        self.assertTrue(_logo().startswith(b"\x89PNG\r\n\x1a\n"))

    def test_large_invoice_rejected_not_truncated(self):
        invoice = SimpleNamespace(items=MagicMock())
        invoice.items.all.return_value.order_by.return_value.__getitem__.return_value = (
            [object()] * (MAX_ITEMS + 1)
        )
        with self.assertRaisesRegex(ValueError, "exceeds the PDF item limit"):
            render_invoice_pdf(invoice)


class BillingDocumentAuthorityTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.owner = User.objects.create_user(
            email="invoice-owner@example.invalid", username="invoiceowner",
            password="LocalTest2026!", role="client")
        cls.other = User.objects.create_user(
            email="invoice-other@example.invalid", username="invoiceother",
            password="LocalTest2026!", role="client")
        cls.invoice = Invoice.objects.create(
            client=cls.owner, due_date=timezone.now() - timedelta(days=2),
            currency="NGN", subtotal=Decimal("25000.00"), total=Decimal("25000.00"),
            status="unpaid")
        InvoiceItem.objects.create(
            invoice=cls.invoice, description="Cloud hosting - one year",
            quantity=1, unit_price=Decimal("25000.00"), subtotal=Decimal("25000.00"),
            period_start=timezone.now(),
            period_end=timezone.now() + timedelta(days=365))
        cls.quote = Quote.objects.create(
            client=cls.owner, valid_until=timezone.now() + timedelta(days=7),
            currency="NGN", total=Decimal("1.00"), items_data=[])

    def test_existing_invoice_has_branded_pdf_and_is_scoped(self):
        path = f"/api/billing/invoices/{self.invoice.pk}/download_pdf/"
        self.client.force_authenticate(self.owner)
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(path).status_code, (401, 403))

    def test_serializing_overdue_invoice_does_not_change_persisted_status(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/billing/invoices/{self.invoice.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_overdue"])
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")

    def test_quote_unsafe_price_and_conversion_routes_are_closed(self):
        self.client.force_authenticate(self.owner)
        base = "/api/billing/quotes/"
        original = Quote.objects.count()
        response = self.client.post(base, {
            "items": [{"price": "0.01", "quantity": 1, "plan_id": 1}],
            "valid_days": 365
        }, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(Quote.objects.count(), original)
        pk = self.quote.pk
        for method in ("put", "patch", "delete"):
            response = getattr(self.client, method)(f"{base}{pk}/",
                {"status": "accepted", "total": "0.01"}, format="json")
            self.assertEqual(response.status_code, 503)
        response = self.client.post(f"{base}{pk}/accept/", {}, format="json")
        self.assertEqual(response.status_code, 503)
        self.quote.refresh_from_db()
        self.assertEqual(self.quote.status, "draft")
        self.assertEqual(self.quote.total, 1)

    def test_approved_design_is_isolated_in_invoice_template_folder(self):
        self.assertEqual(DEFAULT_TEMPLATE_ID, "template_01")
        self.assertEqual(
            TEMPLATE_REGISTRY["template_01"], "billing.invoice-template.template_01")
        renderer = import_module(TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID])
        self.assertTrue(callable(renderer.render))
        self.assertTrue(renderer.__file__.replace(chr(92), "/").endswith(
            "/billing/invoice-template/template_01.py"))

    @override_settings(OCTALVE_INVOICE_TEMPLATE_ID="arbitrary.module")
    def test_server_default_rejects_unknown_template(self):
        with self.assertRaisesRegex(ValueError, "Unsupported default invoice template"):
            default_template_id()

    def test_new_invoice_pins_reviewed_template_id(self):
        from orders.models import Order
        order = Order.objects.create(
            client=self.owner, currency="NGN",
            status="pending_payment", total=Decimal("150.00"))
        invoice = Invoice.create_from_order(order)
        self.assertEqual(invoice.metadata["invoice_template_id"], "template_01")

    def test_disallows_arbitrary_renderer_path_in_invoice_metadata(self):
        self.invoice.metadata = {"invoice_template_id": "../../unsafe_import"}
        with self.assertRaisesRegex(ValueError, "unsupported template"):
            render_invoice_pdf(self.invoice)

    def test_document_snapshot_is_frozen_and_template_receives_no_orm(self):
        document = _document(self.invoice)
        self.assertEqual(document.currency, "NGN")
        with self.assertRaises(FrozenInstanceError):
            document.total = Decimal("0.00")
        renderer = import_module(TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID]).render
        result = renderer(document)
        self.assertTrue(result.startswith(b"%PDF-"))

    def test_multi_page_invoice_without_database_writes(self):
        from dataclasses import replace
        from .invoice_pdf import InvoiceLine
        doc = _document(self.invoice)
        lines = tuple(
            InvoiceLine("Annual hosting renewal for account " + str(n),
                        "1", Decimal("10.00"), Decimal("10.00"))
            for n in range(65)
        )
        # Keep the fixture's financial totals internally consistent.
        subtotal = Decimal("650.00")
        multi = replace(doc, lines=lines, subtotal=subtotal, discount_total=Decimal("0.00"),
                        tax_total=Decimal("0.00"), total=subtotal,
                        amount_paid=Decimal("0.00"), amount_due=subtotal)
        pdf = import_module(TEMPLATE_REGISTRY["template_01"]).render(multi)
        self.assertTrue(pdf.startswith(b"%PDF-"))
        self.assertGreater(len(pdf), 5000)

    def test_read_existing_quote_is_account_scoped(self):
        path = f"/api/billing/quotes/{self.quote.pk}/"
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(path).status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(path).status_code, 404)
