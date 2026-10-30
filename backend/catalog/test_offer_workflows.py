"""A1/A2 source-of-truth integration tests; all network calls are mocked."""
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from catalog.models import (
    ProductCategory, Product, Plan, PlanBillingCycle,
    CatalogOfferDraft, PublishedCatalogOffer,
)
from providers.models import Provider, ProviderPackage
from providers.inventory import (
    normalize_directadmin_list, normalize_directadmin_detail,
    normalize_whm_packages, fetch_inventory, InventoryError,
)


class InventoryContractTests(SimpleTestCase):
    def test_directadmin_reads_legacy_package_names_and_actual_limits(self):
        self.assertEqual(normalize_directadmin_list('list%5B%5D=starter&list%5B%5D=business'), ['starter', 'business'])
        detail = normalize_directadmin_detail('starter', 'quota=10240&bandwidth=102400&nemails=10')
        self.assertEqual(detail['specs']['quota'], '10240')
        with self.assertRaises(InventoryError):
            normalize_directadmin_list('error=1&text=denied')

    def test_whm_api1_envelope_must_be_successful(self):
        payload = {
            'metadata': {'result': 1, 'reason': 'OK'},
            'data': {'pkg': [{'name': 'enterprise', 'QUOTA': '20480', 'BWLIMIT': '500000'}]}
        }
        self.assertEqual(normalize_whm_packages(payload)[0]['specs']['quota'], '20480')
        with self.assertRaises(InventoryError):
            normalize_whm_packages({'metadata': {'result': 0}, 'data': {'pkg': []}})

    def test_inventory_requires_explicit_tls_host_allowlist_and_no_redirects(self):
        provider = SimpleNamespace(
            base_url='https://panel.example.test:2087', adapter_type='CpanelAdapter',
            username='reseller', timeout_seconds=5, get_api_key=lambda: 'test-key'
        )
        with patch.dict('os.environ', {'CLOUD_INVENTORY_ALLOWED_HOSTS': ''}):
            with self.assertRaises(InventoryError):
                fetch_inventory(provider, getter=lambda *args, **kwargs: None)
        calls = []
        def getter(url, **kwargs):
            calls.append((url,kwargs))
            return SimpleNamespace(status_code=200, content=b'{"ok":1}',
                                   json=lambda: {'metadata': {'result': 1},
                                                 'data': {'pkg': [{'name': 'plan-a', 'QUOTA': '10240'}]}})
        with patch.dict('os.environ', {'CLOUD_INVENTORY_ALLOWED_HOSTS': 'panel.example.test'}):
            plans = fetch_inventory(provider, getter=getter)
        self.assertEqual(plans[0]['provider_package_id'], 'plan-a')
        self.assertFalse(calls[0][1]['allow_redirects'])
        self.assertTrue(calls[0][1]['verify'])
        self.assertEqual(calls[0][1]['params']['want'], 'creatable')


class OfferPublicationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = get_user_model().objects.create_user(
            email='admin@example.test', username='operator', password='StrongPassword123!',
            role='admin', is_staff=True
        )
        cls.client_user = get_user_model().objects.create_user(
            email='client@example.test', username='buyer', password='StrongPassword123!',
            role='client'
        )
        cls.category = ProductCategory.objects.create(name='Hosting')
        cls.product = Product.objects.create(category=cls.category, name='Shared Hosting',
                                             product_type='shared_hosting', status='active', is_public=True)
        cls.provider = Provider.objects.create(
            name='Owned server', adapter_type='CpanelAdapter', base_url='https://panel.example.test:2087',
            status='active', health_status='healthy', config={'fulfillment_model':'owned_server'}
        )
        cls.supplier_package = ProviderPackage.objects.create(
            provider=cls.provider, provider_package_id='business', name='Business',
            specs={'quota': '20480', 'bwlimit': '102400'}, pricing={},
            raw_data={'origin':'adapter_verified','adapter':'CpanelAdapter'}, is_active=True
        )

    def setUp(self):
        self.api=APIClient()
        self.api.force_authenticate(user=self.admin)

    def payload(self, **overrides):
        data = {
            'product_id': self.product.pk,
            'provider_package_id': self.supplier_package.pk,
            'name': 'Octalve Business', 'description': 'Commercially approved hosting',
            'currency': 'NGN', 'is_popular': False,
            'features': [{'label': 'Storage', 'value': '10 GB', 'is_highlighted': True}],
            'billing_cycles': [{'cycle_key':'1mo','price':'3500.00','setup_fee':'0.00',
                                'regular_price':None,'is_default':True}],
        }
        return {**data, **overrides}

    def test_draft_does_not_publish_and_admin_publish_is_versioned(self):
        created=self.api.post('/api/catalog/offer-drafts/',self.payload(),format='json')
        self.assertEqual(created.status_code,201,created.data)
        self.assertEqual(Plan.objects.count(),0)
        approved=self.api.post(f'/api/catalog/offer-drafts/{created.data["id"]}/publish/',{},format='json')
        self.assertEqual(approved.status_code,200,approved.data)
        plan=Plan.objects.get(pk=approved.data['plan_id'])
        self.assertTrue(plan.is_public)
        self.assertEqual(plan.billing_cycles.get(cycle_key='1mo').price,Decimal('3500.00'))
        self.assertEqual(PublishedCatalogOffer.objects.get(plan=plan).revision,1)
        duplicate=self.api.post(f'/api/catalog/offer-drafts/{created.data["id"]}/publish/',{},format='json')
        self.assertEqual(duplicate.status_code,409)
        revised=self.api.post('/api/catalog/offer-drafts/',
                              self.payload(plan_id=plan.pk,billing_cycles=[
                                  {'cycle_key':'1mo','price':'4200.00','setup_fee':'0','regular_price':None,'is_default':True}
                              ]),format='json')
        self.assertEqual(revised.status_code,201,revised.data)
        self.assertEqual(plan.billing_cycles.get(cycle_key='1mo').price,Decimal('3500.00'))
        republish=self.api.post(f'/api/catalog/offer-drafts/{revised.data["id"]}/publish/',{},format='json')
        self.assertEqual(republish.status_code,200,republish.data)
        self.assertEqual(PublishedCatalogOffer.objects.filter(plan=plan).count(),2)
        first=PublishedCatalogOffer.objects.get(plan=plan,revision=1)
        self.assertEqual(first.snapshot['billing_cycles'][0]['price'],'3500.00')

    def test_clients_cannot_set_prices_or_view_internal_provider_inventory(self):
        self.api.force_authenticate(user=self.client_user)
        response=self.api.post('/api/catalog/offer-drafts/',self.payload(),format='json')
        self.assertEqual(response.status_code,403)
        response=self.api.get('/api/providers/packages/')
        self.assertEqual(response.status_code,403)
        response=self.api.post('/api/catalog/plans/',{'name':'fake','base_price':'0'},format='json')
        self.assertEqual(response.status_code,403)

    def test_supplier_capacity_overclaims_are_rejected(self):
        response=self.api.post('/api/catalog/offer-drafts/',
                               self.payload(features=[{'label':'Storage','value':'50 GB','is_highlighted':True}]),
                               format='json')
        self.assertEqual(response.status_code,201)
        published=self.api.post(f'/api/catalog/offer-drafts/{response.data["id"]}/publish/',{},format='json')
        self.assertEqual(published.status_code,400)
        self.assertEqual(Plan.objects.count(),0)

    def test_partner_resale_requires_cost_and_prevents_loss(self):
        self.provider.config={'fulfillment_model':'partner_reseller'}
        self.provider.save(update_fields=['config'])
        response=self.api.post('/api/catalog/offer-drafts/',self.payload(),format='json')
        self.assertEqual(response.status_code,201)
        publish=self.api.post(f'/api/catalog/offer-drafts/{response.data["id"]}/publish/',{},format='json')
        self.assertEqual(publish.status_code,400)
        self.supplier_package.pricing={'currency':'NGN','cycles':{'1mo':'4000.00'}}
        self.supplier_package.save(update_fields=['pricing'])
        publish=self.api.post(f'/api/catalog/offer-drafts/{response.data["id"]}/publish/',{},format='json')
        self.assertEqual(publish.status_code,400)
        self.assertEqual(PublishedCatalogOffer.objects.count(),0)

    def test_checkout_requires_current_published_revision_and_supplier_health(self):
        from orders.serializers import CreateOrderSerializer
        from uuid import uuid4
        draft=self.api.post('/api/catalog/offer-drafts/',self.payload(),format='json')
        self.assertEqual(draft.status_code,201,draft.data)
        published=self.api.post(f'/api/catalog/offer-drafts/{draft.data["id"]}/publish/',{},format='json')
        self.assertEqual(published.status_code,200,published.data)
        plan_id=published.data['plan_id']
        def checkout(revision):
            return CreateOrderSerializer(data={
                'checkout_id':str(uuid4()),
                'items':[{'plan_id':plan_id,'cycle_key':'1mo','offer_revision':revision,'quantity':1}]
            })
        stale=checkout(99)
        self.assertFalse(stale.is_valid())
        current=checkout(1)
        self.assertTrue(current.is_valid(),current.errors)
        self.assertEqual(current.validated_data['items'][0]['published_catalog_offer'].revision,1)
        self.provider.health_status='unhealthy'
        self.provider.save(update_fields=['health_status'])
        disabled=checkout(1)
        self.assertFalse(disabled.is_valid())

    def test_vps_cannot_be_misrepresented_as_directadmin_or_whm_package(self):
        vps=Product.objects.create(category=self.category,name='VPS',product_type='vps')
        draft=self.api.post('/api/catalog/offer-drafts/',self.payload(product_id=vps.pk),format='json')
        self.assertEqual(draft.status_code,201,draft.data)
        published=self.api.post(f'/api/catalog/offer-drafts/{draft.data["id"]}/publish/',{},format='json')
        self.assertEqual(published.status_code,400)
        self.assertFalse(Plan.objects.filter(product=vps).exists())

    def test_duplicate_plan_slug_rejected_before_price_publication(self):
        first=self.api.post('/api/catalog/offer-drafts/',self.payload(slug='octalve-business'),format='json')
        self.assertEqual(first.status_code,201,first.data)
        published=self.api.post(f'/api/catalog/offer-drafts/{first.data["id"]}/publish/',{},format='json')
        self.assertEqual(published.status_code,200,published.data)
        duplicate=self.api.post('/api/catalog/offer-drafts/',
                                self.payload(name='Business alternative',slug='octalve-business'),format='json')
        self.assertEqual(duplicate.status_code,400,duplicate.data)
        self.assertEqual(PublishedCatalogOffer.objects.count(),1)

    def test_existing_public_slug_cannot_change_on_plan_revision(self):
        first=self.api.post('/api/catalog/offer-drafts/',self.payload(),format='json')
        self.assertEqual(first.status_code,201,first.data)
        published=self.api.post(f'/api/catalog/offer-drafts/{first.data["id"]}/publish/',{},format='json')
        plan=Plan.objects.get(pk=published.data["plan_id"])
        change=self.api.post('/api/catalog/offer-drafts/',
                             self.payload(plan_id=plan.pk,slug='new-address'),format='json')
        self.assertEqual(change.status_code,400,change.data)
        self.assertEqual(plan.slug,'octalve-business')

    def test_marketing_feature_line_is_structured_without_fake_supplier_claim(self):
        features=[
            {'label':'Storage','value':'10 GB','is_highlighted':True},
            {'label':'Priority support','value':'','is_highlighted':True},
        ]
        created=self.api.post('/api/catalog/offer-drafts/',self.payload(features=features),format='json')
        self.assertEqual(created.status_code,201,created.data)
        publish=self.api.post(f'/api/catalog/offer-drafts/{created.data["id"]}/publish/',{},format='json')
        self.assertEqual(publish.status_code,200,publish.data)
        plan=Plan.objects.get(pk=publish.data['plan_id'])
        self.assertEqual(plan.features.get(label='Priority support').value,'')
        self.assertEqual(PublishedCatalogOffer.objects.get(plan=plan).snapshot['features'][1]['value'],'')

    def test_product_slug_collision_rejected_at_serializer_boundary(self):
        from rbac.models import Permission, Role, RolePermission, UserRole
        from rbac.utils import clear_user_permissions_cache

        existing = Product.objects.get(pk=self.product.pk)
        payload = {
            'name': 'Different product', 'slug': existing.slug,
            'description': '', 'category': self.category.pk,
            'product_type': 'shared_hosting', 'status': 'inactive',
            'is_public': False, 'features': [],
        }
        # A Cloud Admin role alone does not bypass the granular RBAC decorator.
        # Keep the unauthorized-write check separate from slug validation.
        denied = self.api.post('/api/catalog/products/', payload, format='json')
        self.assertEqual(denied.status_code, 403, denied.content.decode())

        role, _ = Role.objects.get_or_create(
            key='catalog-product-test',
            defaults={'name': 'Catalogue product permission test'},
        )
        permission, _ = Permission.objects.get_or_create(
            key='create_products',
            defaults={'name': 'Create products', 'module': 'products', 'action': 'create'},
        )
        RolePermission.objects.get_or_create(role=role, permission=permission)
        UserRole.objects.get_or_create(user=self.admin, role=role)
        clear_user_permissions_cache(self.admin)

        rejected = self.api.post('/api/catalog/products/', payload, format='json')
        self.assertEqual(rejected.status_code, 400, rejected.content.decode())
        self.assertIn('slug', rejected.json())
        self.assertEqual(Product.objects.filter(slug=existing.slug).count(), 1)

    def test_supplier_sync_stages_changed_limits_without_changing_retail_prices(self):
        self.admin.is_superuser=True
        self.admin.save(update_fields=['is_superuser'])
        with patch('providers.views.fetch_inventory',return_value=[
            {'provider_package_id':'business','name':'Business',
             'specs':{'quota':'10240','bwlimit':'100000'}}
        ]):
            synced=self.api.post(f'/api/providers/providers/{self.provider.pk}/sync_packages/',{},format='json')
        self.assertEqual(synced.status_code,200,synced.data)
        self.supplier_package.refresh_from_db()
        self.assertFalse(self.supplier_package.is_active)
        self.assertEqual(self.supplier_package.specs['quota'],'10240')
        self.assertEqual(Plan.objects.count(),0)
