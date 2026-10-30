"""Regression gate: server must reject cross-role all-customer reports.

Isolated Django database only. Never use real invoices, payments or credentials.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()

GLOBAL_REPORT_ENDPOINTS = (
    "/api/reports/financial/revenue_summary/?period=day",
    "/api/reports/financial/revenue_by_gateway/",
    "/api/reports/financial/revenue_by_product/",
    "/api/reports/widgets/dashboard_data/",
)


class FinancialRoleBoundaryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.client_account = User.objects.create_user(
            email="report-client@example.invalid", username="report_client",
            password="test-password-only", role="client",
        )
        cls.staff_account = User.objects.create_user(
            email="report-staff@example.invalid", username="report_staff",
            password="test-password-only", role="staff", is_staff=True,
        )
        cls.admin_account = User.objects.create_user(
            email="report-admin@example.invalid", username="report_admin",
            password="test-password-only", role="admin", is_staff=True,
        )
        cls.superuser = User.objects.create_superuser(
            email="report-super@example.invalid", username="report_super",
            password="test-password-only",
        )

    def test_client_and_staff_cannot_read_cross_customer_financial_data(self):
        for account in (self.client_account, self.staff_account):
            api = APIClient()
            api.force_authenticate(user=account)
            for endpoint in GLOBAL_REPORT_ENDPOINTS:
                with self.subTest(role=account.role, endpoint=endpoint):
                    response = api.get(endpoint)
                    self.assertEqual(response.status_code, 403, response.data)
                    self.assertNotIn(b"total_revenue", response.content)
                    self.assertNotIn(b"recent_activities", response.content)

    def test_anonymous_cannot_read_global_financial_data(self):
        for endpoint in GLOBAL_REPORT_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = APIClient().get(endpoint)
                self.assertIn(response.status_code, (401, 403))
                self.assertNotIn(b"total_revenue", response.content)

    def test_admin_role_and_superuser_keep_authorized_read_access(self):
        for account in (self.admin_account, self.superuser):
            api = APIClient()
            api.force_authenticate(user=account)
            for endpoint in GLOBAL_REPORT_ENDPOINTS:
                with self.subTest(role=account.role, endpoint=endpoint):
                    response = api.get(endpoint)
                    self.assertEqual(response.status_code, 200, response.data)

    def test_financial_report_endpoints_do_not_accept_client_writes(self):
        api = APIClient()
        api.force_authenticate(user=self.client_account)
        for endpoint in GLOBAL_REPORT_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = api.post(endpoint, {}, format="json")
                self.assertIn(response.status_code, (403, 405))

    def test_role_spoofed_admin_without_staff_flag_is_rejected(self):
        untrusted = User.objects.create_user(
            email="report-spoof@example.invalid", username="report_spoof",
            password="test-password-only", role="admin", is_staff=False,
        )
        api = APIClient()
        api.force_authenticate(user=untrusted)
        for endpoint in GLOBAL_REPORT_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(api.get(endpoint).status_code, 403)

    def test_reports_metadata_and_exports_do_not_cross_roles(self):
        endpoints = (
            "/api/reports/definitions/", "/api/reports/instances/",
            "/api/reports/widgets/", "/api/reports/filters/",
            "/api/reports/metrics/",
        )
        for user in (self.client_account, self.staff_account):
            api = APIClient()
            api.force_authenticate(user=user)
            for endpoint in endpoints:
                with self.subTest(role=user.role, endpoint=endpoint):
                    self.assertEqual(api.get(endpoint).status_code, 403)
                    self.assertEqual(api.post(endpoint, {}, format="json").status_code, 403)

    def test_unsafe_export_is_closed_even_for_superuser(self):
        from reports.models import ReportDefinition
        from django.utils import timezone
        report = ReportDefinition.objects.create(
            name="Private export gate", report_type="invoices",
            created_by=self.superuser,
        )
        api = APIClient()
        api.force_authenticate(user=self.superuser)
        result = api.post(
            f"/api/reports/definitions/{report.pk}/generate/",
            {"period_start": timezone.now().isoformat(),
             "period_end": timezone.now().isoformat(), "format": "csv"},
            format="json",
        )
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("download_url", result.data)
