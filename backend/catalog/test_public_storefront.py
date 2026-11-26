from time import monotonic


from catalog.public_site_inspection import inspect_redirects, public_addresses, validate_address
from providers.public_google import GEMINI_URL, PublicGoogleUnavailable, generate_json, page_speed
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from unittest.mock import MagicMock, patch
from providers.web_risk import ENDPOINT, WebRiskUnavailable, lookup
from rest_framework.test import APIClient
from catalog.models import ProductCategory, Product, Plan, PlanBillingCycle, PublishedCatalogOffer
from domains.models import TLDPricing
from knowledge_base.models import KnowledgeArticle
from django.contrib.auth import get_user_model

class PublicStorefrontTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        cat = ProductCategory.objects.create(name="Hosting")
        self.product = Product.objects.create(category=cat, name="Shared Web", product_type="shared_hosting")
        self.plan = Plan.objects.create(product=self.product, name="Starter", base_price=8600, currency="NGN")
        PlanBillingCycle.objects.create(plan=self.plan,cycle_key="1mo",months=1,price=8600,is_active=True)
        self.admin = get_user_model().objects.create_user(username="pubeditor",email="pubeditor@example.invalid",password="test-pass")
    def test_unpublished_products_are_never_advertised(self):
        result=self.api.get("/api/storefront/plans/")
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.data["plans"],[])
        PublishedCatalogOffer.objects.create(plan=self.plan,revision=1,snapshot={})
        result=self.api.get("/api/storefront/plans/")
        self.assertEqual(len(result.data["plans"]),1)
        self.assertEqual(result.data["plans"][0]["billing_cycles"][0]["total_price"],"8600.00")
        self.assertEqual(result.data["plans"][0]["product_slug"],self.product.slug)
        self.assertEqual(result.data["plans"][0]["slug"],self.plan.slug)
        self.assertEqual(result.data["plans"][0]["published_revision"],1)
        self.assertNotIn("supplier_inventory_id",str(result.data))
        self.assertNotIn("provider_package",str(result.data))
        self.plan.is_public=False
        self.plan.save(update_fields=["is_public"])
        self.assertEqual(self.api.get("/api/storefront/plans/").data["plans"],[])
    def test_active_unpublished_plans_hidden_from_customer_catalog(self):
        customer = get_user_model().objects.create_user(
            username="testcustomer", email="testcustomer@example.invalid", password="test-pass")
        self.api.force_authenticate(user=customer)
        first = self.api.get("/api/catalog/plans/")
        self.assertEqual(first.status_code, 200)
        first_data = first.data.get("results", first.data) if isinstance(first.data, dict) else first.data
        self.assertFalse(any(item["id"] == self.plan.pk for item in first_data))
        PublishedCatalogOffer.objects.create(plan=self.plan, revision=1, snapshot={})
        second = self.api.get("/api/catalog/plans/")
        second_data = second.data.get("results", second.data) if isinstance(second.data, dict) else second.data
        self.assertTrue(any(item["id"] == self.plan.pk for item in second_data))
        self.api.force_authenticate(user=None)

    def test_categories_require_published_priced_active_offers(self):
        url = "/api/storefront/categories/"
        self.assertEqual(self.api.get(url).data["categories"], [])
        PublishedCatalogOffer.objects.create(plan=self.plan, revision=1, snapshot={})
        self.assertEqual([c["name"] for c in self.api.get(url).data["categories"]], ["Hosting"])
        future = ProductCategory.objects.create(name="Future Security")
        product = Product.objects.create(category=future, name="SSL", product_type="ssl")
        plan = Plan.objects.create(product=product, name="Future", base_price=100, currency="NGN")
        PlanBillingCycle.objects.create(plan=plan, cycle_key="1mo", months=1, price=100, is_active=True)
        self.assertEqual(len(self.api.get(url).data["categories"]), 1)
        PublishedCatalogOffer.objects.create(plan=plan, revision=1, snapshot={})
        categories = self.api.get(url).data["categories"]
        self.assertEqual(len(categories), 2)
        self.assertNotIn("supplier_provider_id", str(categories))
        future.is_active = False
        future.save(update_fields=["is_active"])
        self.assertEqual([c["name"] for c in self.api.get(url).data["categories"]], ["Hosting"])
        self.plan.is_public = False
        self.plan.save(update_fields=["is_public"])
        self.assertEqual(self.api.get(url).data["categories"], [])

    def test_longest_tld_suffix_wins(self):
        TLDPricing.objects.create(tld=".ng",register_price=16000,renewal_price=17000,transfer_price=16000)
        TLDPricing.objects.create(tld=".com.ng",register_price=9000,renewal_price=10000,transfer_price=9000)
        result = self.api.get("/api/storefront/domains/lookup/?domain=school.com.ng")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["tld"], ".com.ng")
        self.assertEqual(result.data["registration_price"], "9000.00")
        self.assertEqual(result.data["availability"], "unverified")

    def test_domain_lookup_never_invents_availability(self):
        TLDPricing.objects.create(tld=".com",register_price=20000,renewal_price=25000,transfer_price=20000)
        data=self.api.get("/api/storefront/domains/lookup/?domain=example.com").data
        self.assertEqual(data["availability"],"unverified")
        self.assertFalse(data["checkout_enabled"])
        self.assertFalse(data["registrar_connected"])
        self.assertEqual(self.api.get("/api/storefront/domains/lookup/?domain=not a domain").status_code,400)
    def test_public_lookup_uses_selected_route_without_exposing_supplier_prices(self):
        TLDPricing.objects.create(
            tld=".com", register_price=20000, renewal_price=25000, transfer_price=20000,
            metadata={"published_registrar": {"connection_id": "6be4f9cf-b8e7-4ef5-a904-8ef0264e1eb8", "credential_version": 1}},
        )
        with patch("domains.public_registrar.query_published_registrar") as query:
            query.return_value = {"registrable": False, "reason": "domain_unavailable", "registration_cost": "9.14"}
            response = self.api.get("/api/storefront/domains/lookup/?domain=example.com")
        self.assertEqual(response.data["availability"], "unavailable")
        self.assertTrue(response.data["registrar_connected"])
        self.assertEqual(response.data["registration_price"], "20000.00")
        self.assertNotIn("9.14", str(response.data))
        self.assertFalse(response.data["checkout_enabled"])

    def test_internal_and_draft_articles_never_leave_admin(self):
        a=KnowledgeArticle.objects.create(title="DNS Tips",slug="dns-tips",category="Domains",
            summary="Manage records",body_markdown="Private",created_by=self.admin,
            status="draft",visibility="client")
        self.assertEqual(self.api.get("/api/storefront/articles/").data["articles"],[])
        a.status="published";a.visibility="internal";a.save()
        self.assertEqual(self.api.get("/api/storefront/articles/").data["articles"],[])
        a.visibility="client";a.save()
        self.assertEqual(len(self.api.get("/api/storefront/articles/").data["articles"]),1)
        detail = self.api.get("/api/storefront/articles/dns-tips/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail["Cache-Control"], "no-store")
        a.status = "draft"
        a.save()
        self.assertEqual(self.api.get("/api/storefront/articles/dns-tips/").status_code, 404)

    def test_public_status_does_not_infer_health_from_liveness(self):
        response = self.api.get("/api/storefront/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "unknown", "monitoring_available": False})
        self.assertEqual(response["Cache-Control"], "no-store")


class PublicWebRiskTests(TestCase):
    endpoint = "/api/storefront/tools/web-risk/"
    target = "https://example.com/path?x=1"
    key = "fixture_only_key_12345"

    def setUp(self):
        self.api = APIClient()
        cache.clear()
        self.addCleanup(cache.clear)

    @override_settings(CLOUD_PUBLIC_WEB_RISK_ENABLED=False)
    def test_default_disabled_and_invalid_target_rejected(self):
        with patch("catalog.public_security.lookup") as provider:
            self.assertEqual(self.api.post(self.endpoint, {"url": self.target}, format="json").status_code, 503)
            for url in ("http://127.0.0.1/", "https://private.internal/", "https://example.com:443/"):
                self.assertEqual(self.api.post(self.endpoint, {"url": url}, format="json").status_code, 400)
        provider.assert_not_called()

    def test_contract_and_global_budget(self):
        with patch("catalog.public_security.configured_key", return_value=self.key), patch(
            "catalog.public_security.reserve_email_attempt", side_effect=[False, True]
        ) as budget, patch("catalog.public_security.lookup", return_value=[]) as provider:
            self.assertEqual(self.api.post(self.endpoint, {"url": self.target}, format="json").status_code, 429)
            provider.assert_not_called()
            result = self.api.post(self.endpoint, {"url": self.target}, format="json")
        self.assertEqual(result.data, {
            "url": self.target, "provider": "google-web-risk", "status": "not-listed", "threats": [],
        })
        self.assertEqual(result["Cache-Control"], "no-store")
        budget.assert_called_with("public-web-risk-provider", "global", 100, 86400)

    def test_transport_is_fixed_and_fails_closed(self):
        with patch("providers.web_risk.requests.Session") as factory:
            session = factory.return_value.__enter__.return_value
            response = MagicMock(status_code=200)
            session.get.return_value.__enter__.return_value = response
            response.raw.read.return_value = b'{"threat":{"threatTypes":["MALWARE"]}}'
            self.assertEqual(lookup(self.key, self.target), ["MALWARE"])
            self.assertEqual(session.get.call_args.args, (ENDPOINT,))
            self.assertEqual(session.get.call_args.kwargs["params"]["uri"], self.target)
            self.assertFalse(session.get.call_args.kwargs["allow_redirects"])
            response.raw.read.return_value = b'{"error":{"message":"provider failure"}}'
            with self.assertRaises(WebRiskUnavailable):
                lookup(self.key, self.target)


class Phase2ToolTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = APIClient()

    def tool(self, name, payload):
        return self.client.post(f"/api/storefront/tools/{name}/", payload, format="json")

    def test_domain_ideas_match_storefront_and_do_not_return_availability(self):
        with patch("catalog.public_google_tools.provider_key", return_value="test"), patch(
            "catalog.public_google_tools.generate_json", return_value={"ideas": ["bright", "bright", "bad.example"]}
        ) as generate:
            answer = self.tool("domain-ideas", {"business": "Flowers", "extension": ".com.ng", "count": 100})
        self.assertEqual(answer.data, {"ideas": ["bright.com.ng"]})
        self.assertEqual(generate.call_args.args[2]["count"], 30)
        self.assertEqual(answer["Cache-Control"], "no-store")

    @override_settings(CLOUD_PUBLIC_GEMINI_ENABLED=False, CLOUD_PUBLIC_PAGESPEED_ENABLED=False)
    def test_default_disabled_before_any_vendor_call(self):
        with patch("providers.public_google.requests.Session") as transport:
            self.assertEqual(self.tool("domain-ideas", {"business": "Flowers", "extension": ".com", "count": 1}).status_code, 503)
            self.assertEqual(self.tool("pagespeed", {"url": "https://example.com/", "strategy": "mobile"}).status_code, 503)
        transport.assert_not_called()

    def test_document_draft_keeps_contact_address_out_of_model_prompt(self):
        payload = {"kind": "cookie", "business": "Flowers", "website": "https://example.com/",
                   "email": "contact@example.com", "country": "Nigeria"}
        with patch("catalog.public_google_tools.provider_key", return_value="test"), patch(
            "catalog.public_google_tools.generate_json", return_value={"text": "[Confirm actual policy details] " * 5}
        ) as generate:
            answer = self.tool("document-draft", payload)
        self.assertTrue(answer.data["draft"])
        self.assertTrue(answer.data["text"].startswith("Draft for review."))
        self.assertNotIn("email", generate.call_args.args[2])

    def test_invented_catalogue_ids_and_private_urls_are_refused(self):
        plans = [{"id": 1, "name": "Starter", "product_type": "hosting"}]
        with patch("catalog.public_google_tools.published_plans", return_value=plans), patch(
            "catalog.public_google_tools.provider_key", return_value="test"
        ), patch("catalog.public_google_tools.generate_json", return_value={"ids": [2]}):
            self.assertEqual(self.tool("recommendations", {"need": "Hosting"}).status_code, 503)
        for url in ("https://localhost/", "https://127.0.0.1/", "https://example.com:444/"):
            with self.subTest(url=url):
                self.assertEqual(self.tool("ssl", {"url": url}).status_code, 400)

    def test_provider_rejects_truncated_completion_and_invalid_score(self):
        with patch("providers.public_google._request", return_value={"candidates": [{"finishReason": "MAX_TOKENS"}]}) as request:
            with self.assertRaises(PublicGoogleUnavailable):
                generate_json("test", "instruction", {}, tokens=128)
        self.assertEqual(request.call_args.args[0], GEMINI_URL + ":generateContent")
        with patch("providers.public_google._request", return_value={"lighthouseResult": {
            "requestedUrl": "https://example.com/", "categories": {"performance": {"score": 2}},
        }}):
            with self.assertRaises(PublicGoogleUnavailable):
                page_speed("test", "https://example.com/", "mobile")



    @override_settings(DEBUG=False, CLOUD_PUBLIC_GEMINI_ENABLED=True, CLOUD_PROVIDER_CUSTODY_VERIFIED=True,
                       CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=True, CLOUD_PUBLIC_GEMINI_CREDENTIAL_VERSION=3,
                       CLOUD_PUBLIC_GEMINI_CONNECTION_ID="ecb6f906-2f6b-46d6-94e3-2c1b0139e258")
    def test_key_is_current_live_and_not_read_when_budget_exhausted(self):
        from rest_framework.exceptions import Throttled
        from catalog.public_google_tools import provider_key

        with patch("catalog.public_google_tools.connection_database_qualified", return_value=True), patch(
            "catalog.public_google_tools.IntegrationConnection.objects.get"
        ) as connection, patch("catalog.public_google_tools.verify_chain"), patch(
            "catalog.public_google_tools.IntegrationCredentialVersion.objects.get"
        ) as version, patch("catalog.public_google_tools.reserve_email_attempt", return_value=False) as reserve, patch(
            "catalog.public_google_tools.unseal_version"
        ) as decrypt:
            with self.assertRaises(Throttled):
                provider_key("gemini")
            self.assertEqual(connection.call_args.kwargs["current_version"], 3)
            self.assertEqual(connection.call_args.kwargs["environment"], "live")
            self.assertEqual(connection.call_args.kwargs["adapter_key"], "google-gemini")
            self.assertTrue(version.call_args.kwargs["revoked_at__isnull"])
            reserve.assert_called_once_with("public-google-gemini", "global", 60, 86400)
            decrypt.assert_not_called()

class InspectionNegativeTests(SimpleTestCase):
    def test_mixed_dns_records_are_rejected_even_with_a_public_record(self):
        with patch("catalog.public_site_inspection.requests.Session") as factory:
            response = MagicMock(status_code=200)
            factory.return_value.__enter__.return_value.get.return_value.__enter__.return_value = response
            response.raw.read.return_value = b'{"Status":0,"Answer":[{"type":1,"data":"8.8.8.8"},{"type":1,"data":"10.0.0.1"}]}'
            with self.assertRaises(PublicGoogleUnavailable):
                public_addresses("example.com", monotonic() + 2)

    def test_non_public_and_transition_addresses_are_refused(self):
        for address in ("10.1.2.3", "127.0.0.1", "169.254.169.254", "100.64.0.1",
                        "::1", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1"):
            with self.subTest(address=address), self.assertRaises(PublicGoogleUnavailable):
                validate_address(address)

    def test_each_redirect_is_revalidated_and_https_cannot_downgrade(self):
        for destination in ("https://private.internal/", "http://example.net/", "https://example.net:444/"):
            with patch("catalog.public_site_inspection.head", return_value=(302, destination)) as request:
                with self.assertRaises(PublicGoogleUnavailable):
                    inspect_redirects("https://example.com/", monotonic() + 2)
            request.assert_called_once()


class IndependentStatusTests(SimpleTestCase):
    @override_settings(CLOUD_INDEPENDENT_STATUS_SUBDOMAIN="octalve", CLOUD_INDEPENDENT_STATUS_PAGE_ID="octalve123")
    def test_mismatched_page_is_unknown_and_events_are_minimal(self):
        from octalve_backend.public_status import extract_status, UNKNOWN

        packet = {
            "page": {"id": "octalve123"},
            "components": [{"status": "degraded_performance"}],
            "status": {"indicator": "minor"},
            "incidents": [{
                "id": "event123", "name": "Slow responses", "status": "monitoring",
                "updated_at": "2026-11-26T09:00:00Z", "internal": "private-data",
            }],
            "scheduled_maintenances": [],
        }
        self.assertEqual(extract_status(packet, "otherpage"), UNKNOWN)
        report = extract_status(packet, "octalve123")
        self.assertEqual(report["status"], "degraded")
        self.assertEqual(report["events"][0]["id"], "event123")
        self.assertNotIn("private-data", str(report))
