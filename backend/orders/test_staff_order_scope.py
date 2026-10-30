"""P0 deny-by-default customer order scope; no Production or provider writes."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from orders.models import Order

User = get_user_model()

class StaffOrderScopeTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email="order-customer@example.invalid",username="order_customer",
            password="test-only",role="client")
        self.staff = User.objects.create_user(
            email="order-staff@example.invalid",username="order_staff",
            password="test-only",role="staff",is_staff=True)
        self.admin = User.objects.create_superuser(
            email="order-admin@example.invalid",username="order_admin",
            password="test-only")
        self.order = Order.objects.create(
            client=self.customer, source="web", status="pending_payment")

    def test_staff_cannot_enumerate_or_retrieve_others_orders(self):
        api=APIClient()
        api.force_authenticate(user=self.staff)
        listed=api.get("/api/orders/orders/")
        self.assertEqual(listed.status_code,200)
        rows=listed.data.get("results",[]) if isinstance(listed.data,dict) else listed.data
        self.assertEqual(len(rows),0)
        self.assertEqual(api.get(f"/api/orders/orders/{self.order.pk}/").status_code,404)

    def test_role_only_admin_cannot_enumerate_orders_or_bypass_write_gate(self):
        role_only = User.objects.create_user(
            email="order-role-only@example.invalid", username="order_role_only",
            password="test-only", role="admin", is_staff=False)
        api = APIClient()
        api.force_authenticate(user=role_only)
        response = api.get("/api/orders/orders/")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", []) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(rows), 0)
        self.assertEqual(api.get(f"/api/orders/orders/{self.order.pk}/").status_code, 404)
        self.assertEqual(
            api.patch(f"/api/orders/orders/{self.order.pk}/", {}, format="json").status_code,
            403,
        )

    def test_client_sees_own_order_and_admin_can_view(self):
        for user in (self.customer,self.admin):
            api=APIClient()
            api.force_authenticate(user=user)
            self.assertEqual(api.get(f"/api/orders/orders/{self.order.pk}/").status_code,200)
