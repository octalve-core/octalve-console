from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import override_settings
from rest_framework.test import APITestCase
from audit.models import AuditLog
from .models import PrivilegedPasskey
from .passkey_continuation import issue_continuation, valid_continuation
from .session_tokens import ConsoleRefreshToken
from .privileged_mfa import ASSURANCE

@override_settings(CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=True, CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=False)
class PasskeyManagementTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(email="auth03b@example.invalid",username="auth03b",password="fixture-password")
        self.key = PrivilegedPasskey.objects.create(user=self.user,credential_id="aw",public_key=b"fixture")
        self.login = "/api/auth/jwt/create/"
        self.credentials = {"email":self.user.email,"password":"fixture-password"}

    def test_continuation_bound_to_exact_password_and_challenge(self):
        start = self.client.post(self.login,{**self.credentials,"passkey_qualification":True},format="json")
        self.assertEqual(start.status_code,428)
        payload = {**self.credentials,"passkey_challenge":start.data["challenge_id"],"passkey_assertion":{"id":"aw"},"passkey_continuation":start.data["continuation"]}
        self.assertTrue(valid_continuation(payload))
        self.assertFalse(valid_continuation({**payload,"password":"wrong"}))
        self.assertFalse(valid_continuation({**payload,"email":"another@example.invalid"}))
        self.assertFalse(valid_continuation({**payload,"passkey_challenge":"0"*36}))
        with patch("accounts.passkey_continuation.signing.loads",side_effect=__import__("django.core.signing",fromlist=["SignatureExpired"]).SignatureExpired()):
            self.assertFalse(valid_continuation(payload))
        # Seven more password requests exhaust the original account budget.
        for _ in range(7):
            self.assertEqual(self.client.post(self.login,{**self.credentials,"password":"wrong"},format="json").status_code,400)
        blocked = self.client.post(self.login,{**payload,"password":"wrong"},format="json")
        self.assertEqual(blocked.status_code,429)
        self.assertIn("Retry-After",blocked)
        from types import SimpleNamespace
        with patch("accounts.privileged_mfa.verify_authentication_response",return_value=SimpleNamespace(credential_id=b"k",new_sign_count=1)):
            self.assertEqual(self.client.post(self.login,payload,format="json").status_code,200)
            self.assertEqual(self.client.post(self.login,payload,format="json").status_code,403)

    def test_own_metadata_and_operator_only_revocation(self):
        other = get_user_model().objects.create_superuser(email="other@example.invalid",username="other",password="fixture")
        PrivilegedPasskey.objects.create(user=other,credential_id="YQ",public_key=b"other")
        token=ConsoleRefreshToken.for_user(self.user)
        token[ASSURANCE]=self.key.pk
        self.client.credentials(HTTP_AUTHORIZATION="Bearer "+str(token.access_token))
        response=self.client.get("/api/auth/passkeys/")
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.data["active_count"],1)
        self.assertEqual(response.data["records"][0]["id"],self.key.pk)
        self.assertNotIn("credential_id",response.data["records"][0])
        self.assertNotIn("public_key",response.data["records"][0])
        self.assertEqual(self.client.post("/api/auth/passkeys/",{},format="json").status_code,405)
        args=dict(account_id=self.user.pk,credential_record_id=self.key.pk,approval_reference="fixture",confirm_independent_approval=True,confirm_surviving_authenticator_and_notification=True)
        with self.assertRaises(CommandError):
            call_command("revoke_privileged_passkey",**args)
        survivor=PrivilegedPasskey.objects.create(user=self.user,credential_id="Yg",public_key=b"survivor")
        with self.assertRaises(CommandError):
            call_command("revoke_privileged_passkey",**args)
        AuditLog.objects.create(actor=self.user,action="login",entity_type="privileged_passkey",entity_name="Privileged passkey sign-in",details={"credential_record_id":survivor.pk})
        call_command("revoke_privileged_passkey",**args)
        self.assertEqual(self.client.get("/api/auth/passkeys/").status_code,401)
        self.assertEqual(self.client.post("/api/auth/jwt/refresh/",{"refresh":str(token)},format="json").status_code,401)
        survivor.refresh_from_db()
        self.assertIsNone(survivor.revoked_at)

    def test_client_cannot_list_privileged_metadata(self):
        client=get_user_model().objects.create_user(email="client03b@example.invalid",username="client03b",password="fixture")
        self.client.force_authenticate(user=client)
        self.assertEqual(self.client.get("/api/auth/passkeys/").status_code,403)

    def test_cleanup_is_bounded_dry_run_and_retains_audit(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import PrivilegedLoginChallenge, PrivilegedPasskeyGrant
        now=timezone.now()
        old=PrivilegedLoginChallenge.objects.create(user=self.user,challenge=b"old",expires_at=now-timedelta(days=8))
        live=PrivilegedLoginChallenge.objects.create(user=self.user,challenge=b"live",expires_at=now+timedelta(minutes=2))
        grant=PrivilegedPasskeyGrant.objects.create(user=self.user,digest="a"*64,approval_reference="fixture",expires_at=now-timedelta(days=8))
        audit=AuditLog.objects.create(actor=self.user,action="settings_updated",entity_type="privileged_passkey",entity_name="fixture")
        call_command("prune_privileged_passkey_ceremonies")
        self.assertTrue(PrivilegedLoginChallenge.objects.filter(pk=old.pk).exists())
        with self.assertRaises(CommandError):
            call_command("prune_privileged_passkey_ceremonies",apply=True)
        call_command("prune_privileged_passkey_ceremonies",apply=True,approval_reference="fixture")
        self.assertFalse(PrivilegedLoginChallenge.objects.filter(pk=old.pk).exists())
        self.assertFalse(PrivilegedPasskeyGrant.objects.filter(pk=grant.pk).exists())
        self.assertTrue(PrivilegedLoginChallenge.objects.filter(pk=live.pk).exists())
        self.assertTrue(PrivilegedPasskey.objects.filter(pk=self.key.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=audit.pk).exists())
