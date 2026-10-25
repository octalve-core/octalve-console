"""BIZ-01 real Django checkout authority regression. No external payment provider."""
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from billing.models import Invoice
from catalog.models import ProductCategory, Product, Plan, PlanBillingCycle
from orders.models import Order, OrderItem


class HostingCheckoutTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="biz01-client@example.test",
            username="biz01client",
            password="unused-ci-credential",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        category = ProductCategory.objects.create(name="Hosting")
        self.product = Product.objects.create(category=category, name="Web Hosting",
                                              product_type="shared_hosting", status="active", is_public=True)
        self.plan = Plan.objects.create(product=self.product, name="Starter", status="active",
                                        is_public=True, currency="NGN")
        self.cycle = PlanBillingCycle.objects.create(
            plan=self.plan, cycle_key="1mo", months=1, is_active=True,
            price=Decimal("1000.00"), setup_fee=Decimal("200.00"),
        )

    def payload(self, key=None):
        return {"checkout_id": str(key or uuid4()), "items": [{
            "plan_id": self.plan.id, "cycle_key": "1mo", "quantity": 1,
        }]}

    def test_order_and_invoice_are_unpaid_with_server_pricing(self):
        payload = self.payload()
        payload["total"] = "0.01"  # Browser-provided totals must never determine invoice amounts.
        result = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        order = Order.objects.get()
        invoice = Invoice.objects.get(order=order)
        self.assertEqual(order.status, "pending_payment")
        self.assertEqual(invoice.status, "unpaid")
        self.assertEqual(order.total, Decimal("1200.00"))
        self.assertEqual(invoice.total, Decimal("1200.00"))
        self.assertEqual(invoice.amount_due, Decimal("1200.00"))
        self.assertEqual(invoice.currency, "NGN")
        self.assertEqual(OrderItem.objects.get().unit_price, Decimal("1200.00"))
        self.assertEqual(result.data["invoice"]["invoice_number"], invoice.invoice_number)

    def test_same_checkout_id_never_creates_second_invoice(self):
        payload = self.payload()
        first = self.client.post("/api/orders/", payload, format="json")
        again = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Invoice.objects.count(), 1)

    def test_non_public_plan_is_rejected_without_financial_documents(self):
        self.plan.is_public = False
        self.plan.save(update_fields=["is_public"])
        result = self.client.post("/api/orders/", self.payload(), format="json")
        self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(Invoice.objects.exists())

    def test_inactive_cycle_is_rejected(self):
        self.cycle.is_active = False
        self.cycle.save(update_fields=["is_active"])
        result = self.client.post("/api/orders/", self.payload(), format="json")
        self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Order.objects.exists())

    def test_client_cannot_modify_order_or_invoice_financial_state(self):
        success = self.client.post("/api/orders/", self.payload(), format="json")
        self.assertEqual(success.status_code, 201, success.data)
        order = Order.objects.get()
        invoice = Invoice.objects.get()
        self.assertEqual(self.client.patch(
            f"/api/orders/{order.id}/", {"status": "paid"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(
            f"/api/billing/invoices/{invoice.id}/", {"status": "paid"}, format="json").status_code, 403)
        order.refresh_from_db()
        invoice.refresh_from_db()
        self.assertEqual(order.status, "pending_payment")
        self.assertEqual(invoice.status, "unpaid")
