"""E6 diagnostic is read-only and never presents liveness as external certification."""
from io import StringIO
import json
from django.core.management import call_command
from django.test import TestCase
from catalog.models import ProductCategory,Product,Plan

class ReleaseInspectorTests(TestCase):
    def test_read_only_redacted_preflight_finds_unpublished_offers(self):
        category=ProductCategory.objects.create(name="Diagnostic category")
        product=Product.objects.create(category=category,name="Diagnostic hosting",
                                       product_type="shared_hosting",status="active",is_public=True)
        Plan.objects.create(product=product,name="Unpublished",status="active",is_public=True)
        out=StringIO()
        call_command("inspect_cloud_release","--json",stdout=out)
        payload=json.loads(out.getvalue().strip())
        self.assertTrue(payload["read_only"])
        self.assertFalse(payload["external_certified"])
        self.assertEqual(payload["database_connection"],"reachable")
        self.assertEqual(payload["migration_parity"],"matched")
        self.assertGreaterEqual(payload["unpublished_public_hosting_plans"],1)
        self.assertEqual(payload["payment_activation"],"not_certified")
        self.assertEqual(payload["provider_execution"],"not_certified")
        self.assertEqual(payload["browser_810_case_acceptance"],"not_certified")
        serialized=out.getvalue().lower()
        self.assertNotIn("password",serialized)
        self.assertNotIn("postgres://",serialized)
