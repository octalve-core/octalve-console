"""Account self-service authorization and trustworthy mail gates."""
from unittest.mock import patch
from urllib.parse import unquote

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.account_self_service import VERIFY_SALT
from django.core import signing

MAIL_SETTINGS = {
    "CLOUD_ACCOUNT_EMAIL_ENABLED": True,
    "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
    "DEFAULT_FROM_EMAIL": "no-reply@example.invalid",
    "FRONTEND_URL": "https://console.cloud.octalve.com",
}

class AccountSelfServiceTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(email="owner@example.invalid", username="owner", password="Strong-Example-2026!")
        self.other = User.objects.create_user(email="other@example.invalid", username="other", password="Strong-Example-2026!")
        self.client.force_authenticate(user=self.user)

    def test_only_self_contact_details_can_be_saved(self):
        result=self.client.patch("/api/auth/profile/",{
            "full_name":"  Customer Person  ", "phone_number":"+2348012345678",
            "company_name":"Company Ltd", "address":"12 Example Avenue",
            "city":"Abuja","state":"FCT","country":"Nigeria","postal_code":"900001",
        },format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name,"Customer Person")
        self.assertEqual(self.user.city,"Abuja")
        self.assertEqual(result.data["email"],self.user.email)
        self.assertFalse(result.data["email_verified"])
        check=self.client.get("/api/auth/profile/")
        self.assertEqual(check.data["address"],"12 Example Avenue")

    def test_cannot_change_authority_or_other_identity(self):
        result=self.client.patch("/api/auth/profile/", {"role":"admin","email":"other@example.invalid"},format="json")
        self.assertEqual(result.status_code,400,result.data)
        self.user.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.user.role,"client")
        self.assertEqual(self.user.email,"owner@example.invalid")
        self.assertIsNone(self.other.address)
        self.assertIsNone(self.user.address)

    def test_email_and_verification_state_cannot_be_self_assigned(self):
        for payload in (
            {"email":"other@example.invalid"},
            {"email_verified":True},
            {"email_verified_at":"2026-10-26T12:00:00Z"},
            {"is_staff":True},
            {"tax_exempt":True},
        ):
            response=self.client.patch("/api/auth/profile/",payload,format="json")
            self.assertEqual(response.status_code,400,(payload,response.data))
        self.user.refresh_from_db()
        self.assertEqual(self.user.email,"owner@example.invalid")
        self.assertFalse(self.user.is_staff)
        self.assertFalse(self.user.tax_exempt)
        self.assertIsNone(self.user.email_verified_at)

    def test_unauthenticated_profile_is_rejected(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/auth/profile/").status_code,(401,403))
        self.assertIn(self.client.patch("/api/auth/profile/",{"address":"unsafe"},format="json").status_code,(401,403))

    @override_settings(CLOUD_ACCOUNT_EMAIL_ENABLED=False)
    def test_mail_actions_fail_closed_without_delivery(self):
        self.assertEqual(self.client.post("/api/auth/email/verification/request/",{},format="json").status_code,503)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post("/api/auth/users/reset_password/",{"email":self.user.email},format="json").status_code,503)

    @override_settings(**MAIL_SETTINGS)
    @patch("accounts.account_self_service.send_mail")
    def test_email_verification_binds_email_password_and_is_one_use(self,send):
        send.return_value=1
        request=self.client.post("/api/auth/email/verification/request/",{},format="json")
        self.assertEqual(request.status_code,202,request.data)
        body=send.call_args.args[1]
        self.assertIn("https://console.cloud.octalve.com/verify-email#token=",body)
        token=unquote(body.split("#token=",1)[1].splitlines()[0])
        self.client.force_authenticate(user=None)
        confirmed=self.client.post("/api/auth/email/verification/confirm/",{"token":token},format="json")
        self.assertEqual(confirmed.status_code,200,confirmed.data)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.email_verified_at)
        replay=self.client.post("/api/auth/email/verification/confirm/",{"token":token},format="json")
        self.assertEqual(replay.status_code,400,replay.data)

    @override_settings(**MAIL_SETTINGS)
    @patch("accounts.account_self_service.send_mail")
    def test_recovery_link_does_not_reveal_account_existence(self,send):
        send.return_value=1
        self.client.force_authenticate(user=None)
        known=self.client.post("/api/auth/users/reset_password/",{"email":self.user.email},format="json")
        missing=self.client.post("/api/auth/users/reset_password/",{"email":"missing@example.invalid"},format="json")
        self.assertEqual(known.status_code,202,known.data)
        self.assertEqual(missing.status_code,202,missing.data)
        self.assertEqual(known.data,missing.data)
        self.assertEqual(send.call_count,1)
        self.assertIn("/reset-password/confirm/",send.call_args.args[1])

    @override_settings(**MAIL_SETTINGS)
    @patch("accounts.account_self_service.send_mail")
    def test_email_request_is_bounded(self,send):
        send.return_value=1
        codes=[self.client.post("/api/auth/email/verification/request/",{},format="json").status_code for _ in range(4)]
        self.assertEqual(codes,[202,202,202,429])


class AccountLanguagePreferenceTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(email="locale-owner@example.invalid",
            username="locale_owner", password="NotARealPassword2026!")
        self.other = User.objects.create_user(email="locale-other@example.invalid",
            username="locale_other", password="NotARealPassword2026!")
        self.client.force_authenticate(user=self.owner)

    def test_default_english_and_no_migration(self):
        result = self.client.get("/api/auth/language/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["language"], "en")
        self.assertFalse(result.data["enabled"])
        self.assertEqual([row["code"] for row in result.data["available_languages"]], ["en"])

    def test_nonactivated_french_fails_closed(self):
        result = self.client.patch("/api/auth/language/", {"language": "fr"}, format="json")
        self.assertEqual(result.status_code, 409)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.language, "en")

    @override_settings(CLOUD_MULTILINGUAL_ENABLED=True)
    def test_enabled_owner_only_update_and_reloaded_value(self):
        result = self.client.patch("/api/auth/language/", {"language": "fr"}, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["language"], "fr")
        self.owner.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.owner.language, "fr")
        self.assertEqual(self.other.language, "en")
        self.assertEqual(self.client.get("/api/auth/language/").data["language"], "fr")

    @override_settings(CLOUD_MULTILINGUAL_ENABLED=True)
    def test_strict_allowlist_blocks_extra_fields_bad_types_and_other_account(self):
        for payload in (
            {"language": "ar"}, {"language": "fr-CA"}, {"language": "FR"},
            {"language": None}, {"language": ["fr"]},
            {"language": "fr", "user_id": self.other.pk}, {},
        ):
            with self.subTest(payload=payload):
                response = self.client.patch("/api/auth/language/", payload, format="json")
                self.assertEqual(response.status_code, 400, response.data)
        self.owner.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.owner.language, "en")
        self.assertEqual(self.other.language, "en")

    def test_unauthenticated_language_read_and_write_are_rejected(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/auth/language/").status_code, (401, 403))
        self.assertIn(self.client.patch("/api/auth/language/",
            {"language": "en"}, format="json").status_code, (401, 403))

    def test_preexisting_unsupported_language_has_safe_effective_fallback(self):
        self.owner.language = "zz"
        self.owner.save(update_fields=["language"])
        result = self.client.get("/api/auth/language/")
        self.assertEqual(result.data["language"], "en")
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.language, "zz")  # A GET must never mutate history.
