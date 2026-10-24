"""BIZ-01 regression: customers cannot mutate financial authority."""
from types import SimpleNamespace

from django.test import SimpleTestCase
from orders.views import OrderWriteAuthority
from billing.views import InvoiceWriteAuthority


class BIZ01WriteAuthorityTests(SimpleTestCase):
    def setUp(self):
        self.client_user = SimpleNamespace(is_authenticated=True, is_superuser=False, role="client")
        self.admin_user = SimpleNamespace(is_authenticated=True, is_superuser=False, role="admin")
        self.anonymous = SimpleNamespace(is_authenticated=False, is_superuser=False, role="client")

    def allowed(self, permission, user, action):
        return permission().has_permission(SimpleNamespace(user=user), SimpleNamespace(action=action))

    def test_client_can_create_order_but_not_patch_paid_or_provisioned_status(self):
        self.assertTrue(self.allowed(OrderWriteAuthority, self.client_user, "create"))
        for action in ("update", "partial_update", "destroy"):
            with self.subTest(action=action):
                self.assertFalse(self.allowed(OrderWriteAuthority, self.client_user, action))
                self.assertTrue(self.allowed(OrderWriteAuthority, self.admin_user, action))

    def test_client_cannot_create_or_mutate_invoice(self):
        for action in ("create", "update", "partial_update", "destroy"):
            with self.subTest(action=action):
                self.assertFalse(self.allowed(InvoiceWriteAuthority, self.client_user, action))
                self.assertFalse(self.allowed(InvoiceWriteAuthority, self.anonymous, action))
                self.assertTrue(self.allowed(InvoiceWriteAuthority, self.admin_user, action))

    def test_client_can_read_own_invoices_without_write_permission(self):
        for action in ("list", "retrieve"):
            self.assertTrue(self.allowed(InvoiceWriteAuthority, self.client_user, action))
