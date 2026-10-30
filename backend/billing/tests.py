"""Regression: no fabricated billing status, unsafe quotes or cross-tenant PDFs."""
from datetime import timedelta
import re
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

    def test_approved_four_item_invoice_keeps_notes_on_one_page(self):
        from dataclasses import replace
        from .invoice_pdf import InvoiceLine
        doc = _document(self.invoice)
        amounts = [Decimal("120000.00"), Decimal("25000.00"),
                   Decimal("30000.00"), Decimal("50000.00")]
        lines = tuple(InvoiceLine(f"Example hosting plan {index}", "1", value, value)
                      for index, value in enumerate(amounts))
        subtotal = sum(amounts)
        tax = Decimal("16875.00")
        typical = replace(
            doc, lines=lines, subtotal=subtotal, tax_total=tax,
            discount_total=Decimal("0.00"), total=subtotal + tax,
            amount_paid=Decimal("0.00"), amount_due=subtotal + tax,
            notes="SAMPLE PREVIEW ONLY - NO PAYMENT IS DUE. "
                  "This is not an issued invoice, tax record, or proof of payment. "
                  "All customer details are fictional."
        )
        pdf = import_module(TEMPLATE_REGISTRY["template_01"]).render(typical)
        pages = len(re.findall(rb"/Type\s*/Page\b", pdf))
        self.assertEqual(pages, 1, "A normal invoice must not strand Notes on page two")

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
        self.assertGreater(len(re.findall(rb"/Type\s*/Page\b", pdf)), 1)


    def test_admin_invoice_write_cannot_fake_paid_or_change_totals(self):
        User = get_user_model()
        admin = User.objects.create_user(
            email="invoice-admin@example.invalid", username="invoiceadmin",
            password="LocalTest2026!", role="admin", is_staff=True)
        self.client.force_authenticate(admin)
        base = "/api/billing/invoices/"
        amount = self.invoice.total
        count = Invoice.objects.count()
        self.assertEqual(self.client.post(base, {
            "client": self.owner.id, "status": "paid",
            "total": "0.01", "amount_paid": "0.01",
            "due_date": timezone.now().isoformat(),
        }, format="json").status_code, 503)
        self.assertEqual(Invoice.objects.count(), count)
        for method in ("put", "patch", "delete"):
            result = getattr(self.client, method)(
                f"{base}{self.invoice.pk}/",
                {"status": "paid", "total": "0.01", "client": self.other.pk},
                format="json",
            )
            self.assertEqual(result.status_code, 503, method)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.total, amount)
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertEqual(self.invoice.client_id, self.owner.pk)
        self.assertEqual(Invoice.objects.count(), count)

    def test_template_catalog_admin_only_and_sample_pdf_no_customer_data(self):
        User = get_user_model()
        admin = User.objects.create_user(
            email="studio-admin@example.invalid", username="studioadmin",
            password="LocalTest2026!", role="admin", is_staff=True)
        list_path = "/api/billing/invoices/templates/"
        preview_path = "/api/billing/invoices/template-preview/?template_id=template_01"
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(list_path).status_code, 403)
        self.assertEqual(self.client.get(preview_path).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(list_path).status_code, (401, 403))
        self.client.force_authenticate(admin)
        total = Invoice.objects.count()
        result = self.client.get(list_path)
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.data["editing_enabled"])
        self.assertFalse(result.data["historical_snapshots_ready"])
        self.assertEqual(result.data["templates"][0]["id"], "template_01")
        preview = self.client.get(preview_path)
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.content.startswith(b"%PDF-"))
        self.assertIn("no-store", preview["Cache-Control"])
        self.assertEqual(Invoice.objects.count(), total)
        self.assertEqual(
            self.client.get("/api/billing/invoices/template-preview/?template_id=../evil").status_code,
            404,
        )
        self.assertEqual(self.client.post(list_path, {}, format="json").status_code, 405)

    def test_private_quote_conversion_still_requires_server_requote(self):
        from orders.models import Order
        self.assertFalse(Order.objects.filter(client=self.owner).exists())
        with self.assertRaisesRegex(ValueError, "approved server-priced checkout"):
            self.quote.convert_to_order()
        self.quote.refresh_from_db()
        self.assertEqual(self.quote.status, "draft")
        self.assertFalse(Order.objects.filter(client=self.owner).exists())


    def test_admin_quote_list_is_live_read_only_and_no_conversion(self):
        from orders.models import Order
        User = get_user_model()
        admin = User.objects.create_user(
            email="quote-admin@example.invalid", username="quoteadmin",
            password="LocalTest2026!", role="admin", is_staff=True)
        self.client.force_authenticate(admin)
        before = Quote.objects.count()
        response = self.client.get("/api/billing/quotes/")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", []) if isinstance(response.data, dict) else response.data
        self.assertTrue(any(item["quote_number"] == self.quote.quote_number for item in rows))
        self.assertEqual(
            self.client.post("/api/billing/quotes/", {
                "client": self.owner.pk, "items": [{"unit_price": "0.01"}],
            }, format="json").status_code, 503,
        )
        self.assertEqual(
            self.client.post(f"/api/billing/quotes/{self.quote.pk}/accept/", {}, format="json").status_code,
            503,
        )
        self.assertEqual(Quote.objects.count(), before)
        self.quote.refresh_from_db()
        self.assertEqual(self.quote.status, "draft")
        self.assertFalse(Order.objects.filter(client=self.owner).exists())


    def test_renewal_preview_is_admin_only_and_read_only(self):
        from services.models import Service
        User = get_user_model()
        admin = User.objects.create_user(
            email="renewal-admin@example.invalid", username="renewaladmin",
            password="LocalTest2026!", role="admin", is_staff=True)
        service = Service.objects.create(
            client=self.owner, product_id=1, plan_id=1, label="Synthetic hosting",
            status="active", billing_cycle="12mo", amount=Decimal("50000.00"),
            currency="NGN", next_due_date=timezone.now() + timedelta(days=5),
        )
        path = "/api/billing/invoices/renewal-preview/"
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(path).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(path).status_code, (401, 403))
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get(path + "?days=0").status_code, 400)
        self.assertEqual(self.client.get(path + "?days=91").status_code, 400)
        self.assertEqual(self.client.post(path, {}, format="json").status_code, 405)
        before = Invoice.objects.count()
        result = self.client.get(path + "?days=10")
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.data["preview_only"])
        self.assertFalse(result.data["billing_enabled"])
        found = next(item for item in result.data["results"] if item["id"] == str(service.pk))
        self.assertEqual(found["status"], "needs_billing_policy_review")
        self.assertEqual(Invoice.objects.count(), before)
        service.refresh_from_db()
        self.assertEqual(service.status, "active")

    def test_renewal_preview_blocks_opt_out_and_existing_open_invoice(self):
        from services.models import Service
        User = get_user_model()
        admin = User.objects.create_user(
            email="renewal-otheradmin@example.invalid", username="renewalotheradmin",
            password="LocalTest2026!", role="admin", is_staff=True)
        service = Service.objects.create(
            client=self.owner, product_id=1, plan_id=1, label="Synthetic opt-out",
            status="active", billing_cycle="1mo", amount=Decimal("1500.00"),
            currency="NGN", next_due_date=timezone.now() + timedelta(days=3),
            auto_renew=False,
        )
        self.client.force_authenticate(admin)
        path = "/api/billing/invoices/renewal-preview/"
        first = self.client.get(path)
        self.assertEqual(next(item["status"] for item in first.data["results"]
            if item["id"] == str(service.pk)), "renewal_not_authorized")
        Invoice.objects.create(
            client=self.owner, due_date=timezone.now() + timedelta(days=3),
            status="unpaid", total=Decimal("1500.00"),
            metadata={"type": "renewal", "service_id": service.pk},
        )
        before=Invoice.objects.count()
        result=self.client.get(path)
        self.assertEqual(next(item["status"] for item in result.data["results"]
            if item["id"] == str(service.pk)), "existing_open_invoice")
        self.assertEqual(Invoice.objects.count(), before)

    def test_read_existing_quote_is_account_scoped(self):
        path = f"/api/billing/quotes/{self.quote.pk}/"
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(path).status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(path).status_code, 404)
