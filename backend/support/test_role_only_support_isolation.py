"""Regression: role strings alone never grant ticket, internal note or admin data access.

These tests use only disposable Django test data and trigger no notifications,
provider actions or external services.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import ProductCategory, Product, Plan
from support.models import SupportDepartment, SupportTicket, TicketMessage


class RoleOnlySupportIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        users = get_user_model()
        cls.owner = users.objects.create_user(
            email="support-owner@example.invalid", username="support_owner",
            password="test-only", role="client")
        cls.role_admin = users.objects.create_user(
            email="support-role-admin@example.invalid", username="support_role_admin",
            password="test-only", role="admin", is_staff=False)
        cls.role_staff = users.objects.create_user(
            email="support-role-staff@example.invalid", username="support_role_staff",
            password="test-only", role="staff", is_staff=False)
        cls.admin = users.objects.create_user(
            email="support-real-admin@example.invalid", username="support_real_admin",
            password="test-only", role="admin", is_staff=True)
        cls.department = SupportDepartment.objects.create(
            name="Support isolation checks", is_active=True)
        cls.ticket = SupportTicket.objects.create(
            client=cls.owner, department=cls.department,
            subject="A private billing question")
        TicketMessage.objects.create(
            ticket=cls.ticket, sender=cls.admin, sender_role="admin",
            message="Internal-only follow-up", is_internal=True)
        cls.category = ProductCategory.objects.create(name="Internal test category")
        cls.hidden_product = Product.objects.create(
            category=cls.category, name="Unpublished internal product",
            status="inactive", is_public=False)
        cls.hidden_plan = Plan.objects.create(
            product=cls.hidden_product, name="Unpublished internal plan",
            status="inactive", is_public=False)

    def _api(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    @staticmethod
    def _rows(response):
        return response.data.get("results", []) if isinstance(response.data, dict) else response.data

    def test_role_only_admin_does_not_list_or_read_other_customer_tickets(self):
        for user in (self.role_admin, self.role_staff):
            with self.subTest(user=user.username):
                api = self._api(user)
                listed = api.get("/api/support/tickets/")
                self.assertEqual(listed.status_code, 200, listed.data)
                self.assertEqual(len(self._rows(listed)), 0)
                self.assertEqual(
                    api.get(f"/api/support/tickets/{self.ticket.pk}/").status_code, 404)
                self.assertEqual(
                    api.post(f"/api/support/tickets/{self.ticket.pk}/reply/",
                             {"message": "Not authorized"}, format="json").status_code, 404)

    def test_role_only_user_cannot_manage_support_configuration(self):
        api = self._api(self.role_admin)
        self.assertEqual(api.get("/api/support/agents/").status_code, 403)
        for path in (
            "/api/support/departments/",
            "/api/support/tags/",
            "/api/support/predefined-responses/",
            "/api/support/escalation-rules/",
        ):
            with self.subTest(path=path):
                response = api.post(path, {}, format="json")
                self.assertEqual(response.status_code, 403, response.data)

    def test_role_only_admin_cannot_read_unpublished_catalog(self):
        api = self._api(self.role_admin)
        for path in ("/api/catalog/products/", "/api/catalog/plans/"):
            with self.subTest(path=path):
                response = api.get(path)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(len(self._rows(response)), 0)
        self.assertEqual(
            api.get(f"/api/catalog/products/{self.hidden_product.pk}/").status_code, 404)
        self.assertEqual(
            api.get(f"/api/catalog/plans/{self.hidden_plan.pk}/").status_code, 404)
        self.assertEqual(api.get("/api/catalog/provider-mappings/").status_code, 403)

    def test_real_admin_can_read_its_authorized_support_records(self):
        api = self._api(self.admin)
        response = api.get(f"/api/support/tickets/{self.ticket.pk}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            len([message for message in response.data["messages"]
                 if message["is_internal"]]), 1)

    def test_customer_internal_messages_remain_hidden(self):
        api = self._api(self.owner)
        response = api.get(f"/api/support/tickets/{self.ticket.pk}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["messages"], [])
