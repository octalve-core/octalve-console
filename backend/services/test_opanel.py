from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from services.models import Service, ServiceUsage


class OPanelIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = get_user_model()
        cls.owner = user.objects.create_user(
            email='opanel-owner@example.test', username='opanelowner',
            password='TestPassword_123', role='client')
        cls.other = user.objects.create_user(
            email='opanel-other@example.test', username='opanelother',
            password='TestPassword_123', role='client')
        cls.service = Service.objects.create(
            client=cls.owner, product_id=1, plan_id=2, provider_id=3,
            status='active', label='Web Hosting', service_type='hosting',
            domain_name='mybusiness.example', provider_identifier='private-provider-account',
            billing_cycle='1mo', amount=Decimal('3000'), currency='NGN',
            next_due_date=timezone.now()+timedelta(days=30))
        ServiceUsage.objects.create(
            service=cls.service, disk_used_mb=512, disk_limit_mb=4096,
            bandwidth_used_mb=100, bandwidth_limit_mb=10240)

    def setUp(self):
        self.api=APIClient()

    def test_owner_sees_redacted_real_service_overview_not_provider_credentials(self):
        self.api.force_authenticate(self.owner)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['usage']['disk_used_mb'],512)
        self.assertFalse(response.data['capabilities']['files'])
        self.assertFalse(response.data['capabilities']['dns'])
        self.assertNotIn('provider_identifier',response.data)
        self.assertNotIn('credentials',response.data)

    def test_unrelated_customer_cannot_enumerate_service(self):
        self.api.force_authenticate(self.other)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,404)

    def test_unauthenticated_client_is_denied(self):
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertIn(response.status_code,(401,403))

    def test_pending_service_does_not_claim_panel_access(self):
        self.service.status='pending'
        self.service.save(update_fields=['status'])
        self.api.force_authenticate(self.owner)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.data['active'])
        self.assertFalse(response.data['capabilities']['panel_sso'])
