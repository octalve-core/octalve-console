from django.test import TestCase
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
        self.assertNotIn("provider_package",str(result.data))
        self.plan.is_public=False
        self.plan.save(update_fields=["is_public"])
        self.assertEqual(self.api.get("/api/storefront/plans/").data["plans"],[])
    def test_domain_lookup_never_invents_availability(self):
        TLDPricing.objects.create(tld=".com",register_price=20000,renewal_price=25000,transfer_price=20000)
        data=self.api.get("/api/storefront/domains/lookup/?domain=example.com").data
        self.assertEqual(data["availability"],"unverified")
        self.assertFalse(data["checkout_enabled"])
        self.assertFalse(data["registrar_connected"])
        self.assertEqual(self.api.get("/api/storefront/domains/lookup/?domain=not a domain").status_code,400)
    def test_internal_and_draft_articles_never_leave_admin(self):
        a=KnowledgeArticle.objects.create(title="DNS Tips",slug="dns-tips",category="Domains",
            summary="Manage records",body_markdown="Private",created_by=self.admin,
            status="draft",visibility="client")
        self.assertEqual(self.api.get("/api/storefront/articles/").data["articles"],[])
        a.status="published";a.visibility="internal";a.save()
        self.assertEqual(self.api.get("/api/storefront/articles/").data["articles"],[])
        a.visibility="client";a.save()
        self.assertEqual(len(self.api.get("/api/storefront/articles/").data["articles"]),1)
        self.assertEqual(self.api.get("/api/storefront/articles/dns-tips/").status_code,200)
