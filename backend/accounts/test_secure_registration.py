"""Batch 1 user-provided identity fields: no privileged mass assignment or fake verification."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from accounts.serializers import CustomUserCreateSerializer

User=get_user_model()

class AccountRegistrationBoundaryTests(TestCase):
    def payload(self,**changes):
        data={
            "full_name":"New Customer",
            "email":"CUSTOMER@EXAMPLE.INVALID",
            "password":"VerySecureTestPassword-2026!",
            "re_password":"VerySecureTestPassword-2026!",
            "phone_number":"+2348012345678",
        }
        data.update(changes)
        return data

    def test_optional_username_generates_unique_non_email_identity(self):
        one=CustomUserCreateSerializer(data=self.payload())
        self.assertTrue(one.is_valid(),one.errors)
        first=one.save()
        self.assertTrue(first.username)
        self.assertLessEqual(len(first.username),30)
        self.assertEqual(first.email,"customer@example.invalid")
        self.assertIsNone(first.phone_verified_at)
        second=CustomUserCreateSerializer(data=self.payload(email="other@example.invalid"))
        self.assertTrue(second.is_valid(),second.errors)
        self.assertNotEqual(second.save().username,first.username)

    def test_username_normalizes_and_rejects_invalid_or_reserved(self):
        for user in ("admin","support","abc xyz","7seven","x","A/../../"):
            with self.subTest(username=user):
                serializer=CustomUserCreateSerializer(data=self.payload(username=user))
                self.assertFalse(serializer.is_valid())
                self.assertIn("username",serializer.errors)

    def test_username_case_insensitive_duplicate_rejected(self):
        first=CustomUserCreateSerializer(data=self.payload(username="GreatUser"))
        self.assertTrue(first.is_valid(),first.errors)
        first.save()
        dupe=CustomUserCreateSerializer(data=self.payload(
            email="different@example.invalid",username="greatuser"))
        self.assertFalse(dupe.is_valid())
        self.assertIn("username",dupe.errors)

    def test_case_insensitive_email_duplicate_rejected(self):
        first=CustomUserCreateSerializer(data=self.payload(username="good_user"))
        self.assertTrue(first.is_valid(),first.errors)
        first.save()
        dupe=CustomUserCreateSerializer(data=self.payload(
            email="customer@EXAMPLE.INVALID",username="other_user"))
        self.assertFalse(dupe.is_valid())
        self.assertIn("email",dupe.errors)

    def test_phone_requires_explicit_international_digits(self):
        for phone in ("08012345678","+00012345678","+1","abc","0044123456789"):
            with self.subTest(phone=phone):
                serializer=CustomUserCreateSerializer(data=self.payload(phone_number=phone))
                self.assertFalse(serializer.is_valid())
                self.assertIn("phone_number",serializer.errors)
        serializer=CustomUserCreateSerializer(data=self.payload(phone_number=""))
        self.assertTrue(serializer.is_valid(),serializer.errors)

    def test_terms_acceptance_records_only_explicit_version(self):
        accepted=CustomUserCreateSerializer(data=self.payload(
            email="terms-accepted@example.invalid",accepted_terms_version="2026-10-30"))
        self.assertTrue(accepted.is_valid(),accepted.errors)
        result=accepted.save()
        self.assertEqual(result.metadata["terms_acceptance"]["version"],"2026-10-30")
        self.assertEqual(result.metadata["terms_acceptance"]["source"],"signup")
        no_acceptance=CustomUserCreateSerializer(data=self.payload(
            email="terms-not-claimed@example.invalid"))
        self.assertTrue(no_acceptance.is_valid(),no_acceptance.errors)
        self.assertNotIn("terms_acceptance",no_acceptance.save().metadata or {})
        invalid=CustomUserCreateSerializer(data=self.payload(
            email="terms-invalid@example.invalid",accepted_terms_version="9999-01-01"))
        self.assertFalse(invalid.is_valid())
        self.assertIn("accepted_terms_version",invalid.errors)

    def test_privileged_fields_rejected_during_signup(self):
        for name,value in (("role","admin"),("is_superuser",True),
                           ("is_staff",True),("wallet_balance",999999),
                           ("email_verified_at","2026-10-30T00:00:00Z")):
            with self.subTest(field=name):
                serializer=CustomUserCreateSerializer(data=self.payload(**{name:value}))
                self.assertFalse(serializer.is_valid())
                self.assertIn("detail",serializer.errors)
