"""Disposable account fixture tests for an advisory, throttled username hint."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class UsernameAvailabilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.existing = get_user_model().objects.create_user(
            email="username-check@example.invalid", username="AlreadyTaken",
            password="test-only", role="client")

    def test_normalized_existing_username_is_not_available(self):
        api = APIClient()
        for value in ("AlreadyTaken", "alreadytaken", " ALREADYTAKEN "):
            with self.subTest(value=value):
                reply = api.post("/api/auth/username-availability/",
                                 {"username": value}, format="json")
                self.assertEqual(reply.status_code, 200, reply.data)
                self.assertEqual(reply.data, {"available": False})
                self.assertIn("no-store", reply["Cache-Control"])

    def test_public_hint_no_identity_data_and_no_reservation(self):
        api = APIClient()
        reply = api.post("/api/auth/username-availability/",
                         {"username": "brand_new_user"}, format="json")
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.data, {"available": True})
        self.assertNotIn("email", str(reply.data))
        self.assertNotIn("id", str(reply.data))
        self.assertEqual(api.get("/api/auth/username-availability/").status_code, 405)

    def test_reserved_invalid_or_oversized_usernames_not_available(self):
        api = APIClient()
        for value in ("admin", "support", "7user", "x", "n" * 61, "../root", ""):
            with self.subTest(value=value):
                reply = api.post("/api/auth/username-availability/",
                                 {"username": value}, format="json")
                self.assertEqual(reply.status_code, 200)
                self.assertEqual(reply.data, {"available": False})
