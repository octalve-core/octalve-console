"""Audited offline promotion of the ONE designated Octalve owner.

Requires production DB operator access, preverified identity and explicit
confirmation. Never exposed by an API, frontend, migration or startup script.
No password reset, account creation, or hidden role escalation on deploy.
"""
import os
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from audit.models import AuditLog

OWNER_EMAIL="octalve0@gmail.com"

class Command(BaseCommand):
    help="Inspect or explicitly approve the existing Octalve owner as Super Admin."

    def add_arguments(self, parser):
        parser.add_argument("--expected-user-id", required=True)
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--confirmation", default="")

    @transaction.atomic
    def handle(self, *args, **options):
        User=get_user_model()
        user=User.objects.select_for_update().filter(email__iexact=OWNER_EMAIL).first()
        if not user or str(user.pk)!=str(options["expected_user_id"]):
            raise CommandError("Owner identity does not match the approved account.")
        current={"role":user.role,"is_staff":user.is_staff,"is_superuser":user.is_superuser}
        if not options["apply"]:
            self.stdout.write("DRY RUN: owner account exists. Id="+str(user.pk)+
                " / role="+user.role+" / staff="+str(user.is_staff)+
                " / superuser="+str(user.is_superuser)+". No changes made.")
            return
        if (options["confirmation"]!="PROMOTE-OCTALVE-OWNER" or
            os.getenv("CLOUD_OWNER_ROLE_CHANGE_APPROVED")!="true" or
            not user.is_active or not user.has_usable_password() or
            user.email_verified_at is None):
            raise CommandError("Approval, verified ownership or account security preconditions missing.")
        if current=={"role":"admin","is_staff":True,"is_superuser":True}:
            self.stdout.write("Owner already authorized as Super Admin. No change.")
            return
        user.role="admin"
        user.is_staff=True
        user.is_superuser=True
        user.save(update_fields=["role","is_staff","is_superuser","updated_at"])
        AuditLog.objects.create(
            actor=None, actor_email="approved-database-operator", action="role_assigned",
            entity_type="CustomUser",entity_id=str(user.pk),entity_name="Owner role promotion",
            old_value=current,
            new_value={"role":"admin","is_staff":True,"is_superuser":True},
            details={"approved_operation":"explicit_owner_superadmin_promotion",
                     "source":"offline_operator_command","requires_new_session":True})
        self.stdout.write("Owner role was updated with an audit receipt; log out and sign in again.")
