"""Isolated RFC6238 enrollment, one-use codes and denied provider writes."""
from unittest.mock import patch
from cryptography.fernet import Fernet
AUDIT_KEY=Fernet.generate_key().decode()
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import DatabaseError
from accounts.models import AuthThrottleBucket
from django.test import override_settings
from rest_framework.test import APITestCase
from providers.connection_models import ProviderVaultAuthenticator,IntegrationConnection
from providers.connection_stepup import otp_at

VAULT_KEY=Fernet.generate_key().decode()
STEP_KEY=Fernet.generate_key().decode()
PASSWORD="CI-Test-Vault-Stepup-Password-1245"
NOW=1800000000
@override_settings(DEBUG=True,CLOUD_PROVIDER_VAULT_KEY=VAULT_KEY,CLOUD_PROVIDER_STEPUP_KEY=STEP_KEY,
                   CLOUD_PROVIDER_AUDIT_KEY=AUDIT_KEY,CLOUD_PROVIDER_VAULT_KEY_ID="v1",CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
                   CLOUD_PROVIDER_SYNTHETIC_REVIEW_WRITES_ENABLED=True,
                   CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=True)
class ProviderStepupTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin=get_user_model().objects.create_superuser(
            email="stepup@example.invalid",username="stepup_admin",password=PASSWORD)
        self.client.force_authenticate(user=self.admin)
        self.patcher=patch("providers.connection_stepup.time.time",return_value=NOW)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
    def test_enrollment_requires_password_and_otp_and_never_accepts_replay(self):
        prefix="/api/providers/security/stepup/"
        self.assertEqual(self.client.get(prefix).data["verified"],False)
        self.assertEqual(self.client.post(prefix+"enroll/",{"confirm_password":"wrong"},format="json").status_code,403)
        result=self.client.post(prefix+"enroll/",{"confirm_password":PASSWORD},format="json")
        self.assertEqual(result.status_code,200,result.data)
        secret=result.data["secret"]
        self.assertEqual(len(secret),32)
        stored=ProviderVaultAuthenticator.objects.get(user=self.admin)
        self.assertNotIn(secret,stored.encrypted_secret)
        code=otp_at(secret,NOW//30)
        self.assertEqual(self.client.post(prefix+"confirm/",{"confirm_password":PASSWORD,"totp_code":"000000"},format="json").status_code,403)
        self.assertEqual(self.client.post(prefix+"confirm/",{"confirm_password":PASSWORD,"totp_code":code},format="json").status_code,200)
        self.assertTrue(self.client.get(prefix).data["verified"])
        self.assertEqual(self.client.post(prefix+"enroll/",{"confirm_password":PASSWORD},format="json").status_code,403)
        self.assertEqual(self.client.post(prefix+"confirm/",{"confirm_password":PASSWORD,"totp_code":code},format="json").status_code,403)
        payload={"adapter_key":"resend","label":"Mail draft","environment":"test",
                 "public_settings":{"sending_domain":"example.com"},
                 "secrets":{"api_key":"SYNTHETIC-TEST-KEY-1234567"},
                 "confirm_password":PASSWORD,"totp_code":code}
        self.assertEqual(self.client.post("/api/providers/connections/",payload,format="json").status_code,403,
                         "Enrollment OTP must not be reusable for credential writes")
        self.assertFalse(IntegrationConnection.objects.exists())
        with patch("providers.connection_stepup.time.time",return_value=NOW+30):
            payload["totp_code"]=otp_at(secret,NOW//30+1)
            self.assertEqual(self.client.post("/api/providers/connections/",payload,format="json").status_code,201)
            self.assertEqual(self.client.post("/api/providers/connections/",payload,format="json").status_code,403)
        self.assertEqual(IntegrationConnection.objects.count(),1)
    def test_no_enrollment_when_off_or_without_distinct_key(self):
        route="/api/providers/security/stepup/enroll/"
        with override_settings(CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=False):
            self.assertEqual(self.client.post(route,{"confirm_password":PASSWORD},format="json").status_code,503)
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=VAULT_KEY):
            self.assertEqual(self.client.post(route,{"confirm_password":PASSWORD},format="json").status_code,503)
        self.assertFalse(ProviderVaultAuthenticator.objects.exists())
    def test_shared_database_security_limit_survives_cache_flush(self):
        route="/api/providers/security/stepup/enroll/"
        cache.clear()
        for index in range(10):
            result=self.client.post(route,{"confirm_password":"wrong"},format="json")
            self.assertEqual(result.status_code,403,(index,result.data))
            cache.clear()  # Previous process cache state must be irrelevant.
        blocked=self.client.post(route,{"confirm_password":"wrong"},format="json")
        self.assertEqual(blocked.status_code,429,blocked.data)
        self.assertTrue(AuthThrottleBucket.objects.filter(attempts=10).exists())
        self.assertFalse(ProviderVaultAuthenticator.objects.exists())

    def test_unavailable_durable_throttle_storage_fails_closed(self):
        route="/api/providers/security/stepup/enroll/"
        with patch("providers.connection_views.spend_durable_auth_attempt",
                   side_effect=DatabaseError("simulated storage outage")):
            result=self.client.post(route,{"confirm_password":"wrong"},format="json")
        self.assertEqual(result.status_code,503,result.data)
        self.assertNotIn("storage outage",str(result.data))
        self.assertFalse(ProviderVaultAuthenticator.objects.exists())

    def test_unenrolled_superadmin_denied_even_with_valid_password(self):
        payload={"adapter_key":"resend","label":"Mail draft","environment":"test",
                 "public_settings":{"sending_domain":"example.com"},
                 "secrets":{"api_key":"SYNTHETIC-TEST-KEY-1234567"},
                 "confirm_password":PASSWORD,"totp_code":"123456"}
        self.assertEqual(self.client.post("/api/providers/connections/",payload,format="json").status_code,403)
        self.assertFalse(IntegrationConnection.objects.exists())
