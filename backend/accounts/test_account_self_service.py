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
        self.assertEqual(self.other.address,"")

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
