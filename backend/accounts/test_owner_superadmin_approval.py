"""No automatic privilege escalation; explicit operator-only owner promotion."""
import io
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone
from audit.models import AuditLog

class OwnerApprovalCommandTests(TestCase):
    def setUp(self):
        U=get_user_model()
        self.owner=U.objects.create_user(
            email="octalve0@gmail.com",username="octalve_owner_ci",
            password="test-owner-password",role="client",is_active=True,
            email_verified_at=timezone.now())
    def call(self,**kwargs):
        return call_command("approve_superadmin_owner",
             expected_user_id=str(self.owner.pk),stdout=io.StringIO(),**kwargs)
    def test_dry_run_does_not_change_any_authority(self):
        self.call()
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.role,"client")
        self.assertFalse(self.owner.is_superuser)
        self.assertFalse(self.owner.is_staff)
        self.assertEqual(AuditLog.objects.filter(action="role_assigned").count(),0)
    def test_mismatch_and_missing_approval_fail_closed(self):
        with self.assertRaises(CommandError):
            call_command("approve_superadmin_owner",expected_user_id="invalid",
                 apply=True,confirmation="PROMOTE-OCTALVE-OWNER")
        with self.assertRaises(CommandError):
            self.call(apply=True,confirmation="PROMOTE-OCTALVE-OWNER")
        self.assertFalse(get_user_model().objects.get(pk=self.owner.pk).is_superuser)
    def test_verified_exact_owner_audited_promotion_and_idempotence(self):
        with patch.dict("os.environ",{"CLOUD_OWNER_ROLE_CHANGE_APPROVED":"true"}):
            self.call(apply=True,confirmation="PROMOTE-OCTALVE-OWNER")
            self.call(apply=True,confirmation="PROMOTE-OCTALVE-OWNER")
        self.owner.refresh_from_db()
        self.assertEqual((self.owner.role,self.owner.is_staff,self.owner.is_superuser),
                         ("admin",True,True))
        receipts=AuditLog.objects.filter(action="role_assigned",entity_id=str(self.owner.pk))
        self.assertEqual(receipts.count(),1)
        self.assertEqual(receipts.first().old_value["role"],"client")
        self.assertEqual(receipts.first().new_value["is_superuser"],True)
    def test_unverified_owner_not_promoted(self):
        self.owner.email_verified_at=None
        self.owner.save(update_fields=["email_verified_at"])
        with patch.dict("os.environ",{"CLOUD_OWNER_ROLE_CHANGE_APPROVED":"true"}):
            with self.assertRaises(CommandError):
                self.call(apply=True,confirmation="PROMOTE-OCTALVE-OWNER")
        self.owner.refresh_from_db()
        self.assertFalse(self.owner.is_superuser)
