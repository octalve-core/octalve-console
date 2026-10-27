"""Signed provider event chain and fail-closed immutability simulations."""
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase,override_settings
from providers.connection_models import IntegrationConnection,IntegrationConnectionEvent
from providers.connection_audit import append_event,verify_chain
from providers.connection_vault import VaultUnavailable

KEY=Fernet.generate_key().decode()
@override_settings(CLOUD_PROVIDER_AUDIT_KEY=KEY)
class ProviderAuditIntegrityTests(TestCase):
    def setUp(self):
        self.admin=get_user_model().objects.create_superuser(email="auditor@example.invalid",
              username="auditor",password="CI-only-Audit-Password-200")
        self.conn=IntegrationConnection.objects.create(
             adapter_key="resend",label="Audit-only draft",environment="test",public_settings={"sending_domain":"example.com"})
    def append(self,action,version):
        with transaction.atomic():
            row=IntegrationConnection.objects.select_for_update().get(pk=self.conn.pk)
            return append_event(row,self.admin,action,version)
    def test_signed_hash_chain_and_missing_event_detected(self):
        self.append("draft_created",1)
        self.append("credential_rotated",2)
        self.conn.refresh_from_db()
        self.assertEqual(verify_chain(self.conn),{"events":2,"integrity_verified":True})
        events=list(IntegrationConnectionEvent.objects.filter(connection=self.conn).order_by("sequence"))
        self.assertEqual(events[1].previous_mac,events[0].event_mac)
        self.assertNotEqual(events[1].event_mac,events[0].event_mac)
        self.assertEqual(self.conn.audit_head,events[1].event_mac)
        self.assertEqual(self.conn.audit_sequence,2)
    def test_model_update_and_delete_are_refused(self):
        self.append("draft_created",1)
        event=IntegrationConnectionEvent.objects.get(connection=self.conn)
        event.action="credential_rotated"
        with self.assertRaises(ValueError):
            event.save()
        with self.assertRaises(ValueError):
            event.delete()
    def test_unauthorized_tampering_fails_chain_verification(self):
        self.append("draft_created",1)
        self.conn.refresh_from_db()
        # SQLite-only simulated privileged corruption; PostgreSQL has a DB trigger
        # that refuses UPDATE/DELETE entirely.
        IntegrationConnectionEvent.objects.filter(connection=self.conn).update(event_mac="0"*64)
        with self.assertRaises(VaultUnavailable):
            verify_chain(self.conn)
        with self.assertRaises(VaultUnavailable):
            self.append("credential_rotated",2)
        self.assertEqual(IntegrationConnectionEvent.objects.count(),1)
    def test_unsigned_old_events_are_not_silently_accepted(self):
        IntegrationConnectionEvent.objects.create(connection=self.conn,actor=self.admin,action="draft_created",version=1)
        with self.assertRaises(VaultUnavailable):
            self.append("credential_rotated",2)
    def test_missing_audit_key_refuses_all_writes(self):
        with override_settings(CLOUD_PROVIDER_AUDIT_KEY=""):
            with self.assertRaises(VaultUnavailable):
                self.append("draft_created",1)
        self.assertEqual(IntegrationConnectionEvent.objects.count(),0)
