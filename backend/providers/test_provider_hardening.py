"""Isolated B0 authority tests; no external provider calls or Production data."""
import json
from django.contrib import admin
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from providers.models import Provider, ProviderLog

class ProviderHardeningTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User=get_user_model()
        cls.admin=User.objects.create_superuser(
            email='security-admin@example.invalid',username='securityadmin',
            password='CI-Not-Deployed-Password-123!')
        cls.client_user=User.objects.create_user(
            email='security-client@example.invalid',username='securityclient',
            password='CI-Not-Deployed-Password-123!')
        cls.provider=Provider.objects.create(
            name='Test provider',adapter_type='DirectAdminAdapter',
            base_url='https://panel.example.invalid:2222',username='reseller',
            status='inactive',config={'fulfillment_model':'owned_server',
            'api_key':'MUST_NEVER_REACH_BROWSER'},metadata={'secret':'MUST_NEVER_REACH_BROWSER'},
            health_check_message='MUST_NEVER_REACH_BROWSER')
        ProviderLog.objects.create(
            provider=cls.provider,action='inventory',endpoint='MUST_NEVER_REACH_BROWSER',
            method='GET',status_code=401,success=False,duration_ms=5,
            error_message='MUST_NEVER_REACH_BROWSER',
            metadata={'secret':'MUST_NEVER_REACH_BROWSER'})
    def test_admin_only_gets_redacted_supplier_profile_and_logs(self):
        self.client.force_authenticate(user=self.admin)
        for url in ['/api/providers/providers/','/api/providers/providers/%s/'%self.provider.pk,
                    '/api/providers/logs/','/api/providers/logs/stats/']:
            response=self.client.get(url)
            self.assertEqual(response.status_code,200,(url,response.data))
            raw=json.dumps(response.data)
            self.assertNotIn('MUST_NEVER_REACH_BROWSER',raw)
            self.assertNotIn('encrypted_api_key',raw)
        details=self.client.get('/api/providers/providers/%s/'%self.provider.pk).data
        self.assertEqual(details['config'],{'fulfillment_model':'owned_server'})
        self.assertEqual(details['metadata'],{})
        self.assertEqual(details['health_check_message'],'')
    def test_superadmin_cannot_use_unqualified_legacy_credential_writes(self):
        self.client.force_authenticate(user=self.admin)
        root='/api/providers/providers/'
        cases=[('post',root,{'name':'Unsafe','adapter_type':'DirectAdminAdapter','base_url':'https://bad.invalid','status':'active','api_key':'test'}),
               ('put',root+str(self.provider.pk)+'/',{'name':'Changed','status':'active'}),
               ('patch',root+str(self.provider.pk)+'/',{'status':'active','secret':'test'}),
               ('delete',root+str(self.provider.pk)+'/',{})]
        for method,url,payload in cases:
            with self.subTest(method=method):
                response=getattr(self.client,method)(url,payload,format='json')
                self.assertEqual(response.status_code,503,(method,response.data))
        self.assertEqual(Provider.objects.count(),1)
        self.provider.refresh_from_db()
        self.assertEqual(self.provider.name,'Test provider')
        self.assertEqual(self.provider.status,'inactive')
    def test_client_denied_provider_records_logs_and_stats(self):
        self.client.force_authenticate(user=self.client_user)
        for url in ['/api/providers/providers/','/api/providers/logs/','/api/providers/logs/stats/']:
            self.assertEqual(self.client.get(url).status_code,403,url)
    def test_django_admin_has_no_ciphertext_or_mutations(self):
        manager=admin.site._registry[Provider]
        for forbidden in ('encrypted_api_key','encrypted_secret','config','metadata','connection_test_button'):
            self.assertNotIn(forbidden,str(manager.fieldsets)+str(manager.list_display))
        for method in ('has_add_permission','has_change_permission','has_delete_permission'):
            self.assertFalse(getattr(manager,method)(None))
