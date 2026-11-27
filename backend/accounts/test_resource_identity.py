from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient
from octalve_backend.resource_identity import make_reference
from octalve_backend.resource_lookup import resource_lookup
from rest_framework.exceptions import NotFound


class ResourceIdentityTests(TestCase):
    def test_account_uuid_and_role_stable_reference(self):
        User=get_user_model()
        owner=User.objects.create_superuser(email="identity-admin@example.invalid",username="identityadmin",password="Fixture-password-123!")
        client=User.objects.create_user(email="identity-client@example.invalid",username="identityclient",password="Fixture-password-123!")
        other=User.objects.create_user(email="identity-other@example.invalid",username="identityother",password="Fixture-password-123!")
        self.assertNotEqual(client.public_id,other.public_id)
        self.assertNotEqual(client.public_reference,other.public_reference)
        self.assertEqual(client.public_id.version,4)
        self.assertRegex(client.public_reference,r"^OC-ACC-(?:[0-9A-Z]{4}-){3}[0-9A-Z]{4}$")
        api=APIClient()
        path=f"/api/auth/customers/{client.public_id}/"
        api.force_authenticate(other)
        self.assertEqual(api.get(path).status_code,403)
        api.force_authenticate(owner)
        result=api.get(path)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.data["public_reference"],client.public_reference)
        old=client.public_reference
        client.save()
        client.refresh_from_db()
        self.assertEqual(client.public_reference,old)
        self.assertEqual(resource_lookup(str(client.public_id)),{"public_id":client.public_id})
        for invalid in ("0","../1","0001","bad-uuid"):
            with self.assertRaises(NotFound):
                resource_lookup(invalid)

    def test_secure_reference_format_and_uniqueness(self):
        refs={make_reference("INV") for _ in range(1000)}
        self.assertEqual(len(refs),1000)
        for ref in refs:
            self.assertRegex(ref,r"^OC-INV-(?:[0-9A-Z]{4}-){3}[0-9A-Z]{4}$")

    def test_postgres_legacy_insert_defaults(self):
        if connection.vendor!="postgresql":
            self.skipTest("PostgreSQL rolling-release defaults")
        with connection.cursor() as cursor:
            cursor.execute("SELECT column_name,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts_customuser' AND column_name IN ('public_id','public_reference')")
            defaults=dict(cursor.fetchall())
        self.assertIn("gen_random_uuid",defaults["public_id"])
        self.assertIn("gen_random_uuid",defaults["public_reference"])
