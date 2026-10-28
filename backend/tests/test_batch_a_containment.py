"""Batch A: URL-resolved, non-destructive checks for closed mutation authority.

No paid records, vendor accounts, customer money or live infrastructure.
These tests intentionally use the real Django URL router rather than
calling isolated class methods which could miss inherited HTTP verbs.
"""
from types import SimpleNamespace
import importlib.util
import unittest

# The lightweight security workflow intentionally does not install Django.
# The Django workflow runs these actual routed checks with full dependencies.
DJANGO_AVAILABLE = importlib.util.find_spec("django") is not None
if DJANGO_AVAILABLE:
    from django.test import SimpleTestCase
    from django.urls import resolve
    from rest_framework.test import APIRequestFactory, force_authenticate
    from settings_registry.serializers import SettingSerializer, SettingChangeLogSerializer
else:
    SimpleTestCase = unittest.TestCase


@unittest.skipUnless(DJANGO_AVAILABLE, 'Django routing checks require Django dependencies')
class BatchARoutedContainmentTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = SimpleNamespace(
            pk=1, is_authenticated=True, is_active=True,
            is_superuser=True, is_staff=True, role="admin",
            has_perm=lambda permission: True,
        )

    def check(self, path, method, expected):
        request = getattr(self.factory, method)(path, data={}, format="json")
        force_authenticate(request, user=self.admin)
        match = resolve(path)
        response = match.func(request, *match.args, **match.kwargs)
        self.assertEqual(
            response.status_code, expected,
            f"{method.upper()} {path} should fail closed",
        )

    def test_wallet_settlement_is_closed_for_authenticated_admin(self):
        self.check("/api/wallet/my-wallet/apply_to_invoice/", "post", 503)

    def test_settings_and_message_templates_do_not_expose_generic_writes(self):
        for resource in ("settings", "email-templates"):
            with self.subTest(resource=resource):
                base = f"/api/settings/{resource}/"
                self.check(base, "post", 405)
                self.check(base + "1/", "put", 405)
                self.check(base + "1/", "patch", 405)
                self.check(base + "1/", "delete", 405)

    def test_provisioning_metadata_does_not_accept_generic_mutations(self):
        for route in ("/api/provisioning/tasks/1/", "/api/provisioning/webhooks/1/"):
            for method in ("put", "patch", "delete"):
                with self.subTest(route=route, method=method):
                    self.check(route, method, 405)
        self.check("/api/provisioning/webhooks/", "post", 405)
        self.check("/api/provisioning/tasks/", "post", 503)

    def test_wallet_request_lifecycle_methods_are_not_generic_edits(self):
        for resource in ("deposits", "withdrawals"):
            for method in ("put", "patch", "delete"):
                with self.subTest(resource=resource, method=method):
                    self.check(f"/api/wallet/{resource}/1/", method, 405)

    def test_gateway_config_is_not_mutable_through_generic_crud(self):
        self.check("/api/payments/gateways/", "post", 405)
        for method in ("put", "patch", "delete"):
            self.check("/api/payments/gateways/1/", method, 405)

    def test_financial_and_service_status_are_not_generic_edits(self):
        for resource in ("/api/orders/orders/1/", "/api/services/services/1/"):
            for method in ("put", "patch", "delete"):
                with self.subTest(resource=resource, method=method):
                    self.check(resource, method, 503)
        self.check("/api/services/services/", "post", 503)


@unittest.skipUnless(DJANGO_AVAILABLE, 'Settings serialization checks require Django dependencies')
class BatchASettingsValueRedactionTests(SimpleTestCase):
    def test_encrypted_setting_values_and_defaults_not_serialized(self):
        secret = SimpleNamespace(
            is_encrypted=True,
            default_value="do-not-disclose-this",
            get_value=lambda: "do-not-disclose-that",
        )
        serializer = SettingSerializer()
        self.assertIsNone(serializer.get_current_value(secret))
        self.assertIsNone(serializer.get_default_value(secret))

    def test_setting_audit_does_not_serialize_before_after_values(self):
        record = SimpleNamespace(old_value="private-old", new_value="private-new")
        serializer = SettingChangeLogSerializer()
        self.assertIsNone(serializer.get_old_value(record))
        self.assertIsNone(serializer.get_new_value(record))
