"""Non-mutating regression tests for commercial and supplier authorities."""
from types import SimpleNamespace
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from catalog.permissions import CatalogPublicationAuthority, InternalSupplierAuthority
from domains.views import DomainSearchViewSet, DomainViewSet, DNSRecordViewSet, SSLCertificateViewSet


class CatalogAuthorityTests(SimpleTestCase):
    def test_catalog_publication_is_admin_only(self):
        users = {
            "client": SimpleNamespace(is_authenticated=True, role="client", is_superuser=False),
            "staff": SimpleNamespace(is_authenticated=True, role="staff", is_superuser=False),
            "admin": SimpleNamespace(is_authenticated=True, role="admin", is_superuser=False, is_staff=True),
        }
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            for role in ("client", "staff"):
                with self.subTest(role=role, method=method):
                    self.assertFalse(CatalogPublicationAuthority().has_permission(
                        SimpleNamespace(user=users[role], method=method), SimpleNamespace()))
            self.assertTrue(CatalogPublicationAuthority().has_permission(
                SimpleNamespace(user=users["admin"], method=method), SimpleNamespace()))
        for role in ("client", "staff", "admin"):
            self.assertTrue(CatalogPublicationAuthority().has_permission(
                SimpleNamespace(user=users[role], method="GET"), SimpleNamespace()))

    def test_role_string_cannot_grant_admin_without_staff_flag(self):
        spoofed=SimpleNamespace(
            is_authenticated=True, role="admin", is_superuser=False, is_staff=False)
        for method in ("GET","POST","PATCH"):
            request=SimpleNamespace(user=spoofed,method=method)
            self.assertFalse(InternalSupplierAuthority().has_permission(request,SimpleNamespace()))
            if method!="GET":
                self.assertFalse(CatalogPublicationAuthority().has_permission(request,SimpleNamespace()))

    def test_supplier_costs_are_never_client_accessible(self):
        for role in ("client", "staff", "admin"):
            user = SimpleNamespace(is_authenticated=True, role=role, is_superuser=False, is_staff=(role == 'admin'))
            for method in ("GET", "POST", "PATCH"):
                allowed = InternalSupplierAuthority().has_permission(
                    SimpleNamespace(user=user, method=method), SimpleNamespace())
                self.assertEqual(allowed, role == "admin")


class UnqualifiedProviderOperationsTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(is_authenticated=True, role="client", is_superuser=False)

    def check(self, cls, action, url, *, method="post", payload=None, auth=False):
        request = getattr(self.factory, method)(url, payload or {}, format="json")
        if auth:
            force_authenticate(request, user=self.user)
        response = cls.as_view({method: action})(request)
        self.assertEqual(response.status_code, 503, (action, response.data))

    def test_search_registration_transfer_and_ssl_never_quote_fake_prices(self):
        self.check(DomainSearchViewSet, "check", "/api/domains/search/check/",
                   payload={"domain_name":"example.com"})
        self.check(DomainSearchViewSet, "register", "/api/domains/search/register/")
        self.check(DomainSearchViewSet, "transfer", "/api/domains/search/transfer/")
        self.check(DomainSearchViewSet, "suggestions", "/api/domains/search/suggestions/", method="get")
        self.check(SSLCertificateViewSet, "order", "/api/domains/ssl-certificates/order/", auth=True)

    def test_no_fabricated_domain_or_ssl_records_from_client(self):
        for cls, url in (
            (DomainViewSet, "/api/domains/domains/"),
            (DNSRecordViewSet, "/api/domains/dns-records/"),
            (SSLCertificateViewSet, "/api/domains/ssl-certificates/"),
        ):
            self.check(cls, "create", url, auth=True)
