"""Paystack encrypted-vault binding is test-only, current-version and fail-closed."""
from unittest.mock import patch
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import seal
from payments.models import PaymentGateway,PaymentIntent
from payments.vault_binding import resolve_paystack_test_key

PASSWORD="fixture-only-paystack-binding"
SECRET="sk_test_"+"R"*36
VAULT=Fernet.generate_key().decode()
STEP=Fernet.generate_key().decode()
AUDIT=Fernet.generate_key().decode()


@override_settings(
    DEBUG=False,CLOUD_PAYSTACK_TEST_BINDING_ENABLED=True,
    CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
    CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=True,
    CLOUD_PROVIDER_CUSTODY_VERIFIED=True,
    CLOUD_PROVIDER_VAULT_KEY=VAULT,CLOUD_PROVIDER_VAULT_KEY_ID="binding-ci",
    CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="",
    CLOUD_PROVIDER_STEPUP_KEY=STEP,CLOUD_PROVIDER_AUDIT_KEY=AUDIT,
)
class PaystackTestBindingTests(TestCase):
    def setUp(self):
        U=get_user_model()
        self.admin=U.objects.create_superuser(
            username="paystack_binding_owner",email="binding-owner@example.invalid",
            password=PASSWORD,email_verified_at=timezone.now())
        self.other=U.objects.create_user(
            username="paystack_binding_client",email="binding-client@example.invalid",
            password=PASSWORD,role="client")
        self.client=APIClient()
        self.client.force_authenticate(user=self.admin)
        self.conn=IntegrationConnection.objects.create(
            adapter_key="paystack",label="Verified fixture",
            environment="test",public_settings={},created_by=self.admin)
        IntegrationCredentialVersion.objects.create(
            connection=self.conn,version=1,key_id="binding-ci",
            ciphertext=seal("paystack",self.conn.pk,1,{"secret_key":SECRET}))
        self.endpoint="/api/payments/admin/paystack-test-binding/"
        self.body={"connection_id":str(self.conn.pk),"confirm_password":PASSWORD,"totp_code":"123456"}

    def test_positive_binding_stores_pointer_only_and_never_enables_payments(self):
        with patch("payments.vault_binding.connection_database_qualified",return_value=True),\
             patch("payments.vault_binding.check_mutation",return_value=None),\
             patch("payments.vault_binding._verified_test_connection",return_value=True),\
             patch("payments.vault_binding.verify_chain",return_value=None):
            response=self.client.post(self.endpoint,self.body,format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertFalse(response.data["live_payments_enabled"])
        gateway=PaymentGateway.objects.get(code="paystack")
        self.assertTrue(gateway.test_mode)
        self.assertEqual(gateway.status,"test")
        self.assertFalse(gateway.encrypted_secret_key)
        self.assertFalse(gateway.encrypted_webhook_secret)
        self.assertEqual(gateway.config["provider_vault_connection_id"],str(self.conn.pk))
        self.assertEqual(gateway.config["provider_vault_version"],1)
        self.assertNotIn(SECRET,str(response.data))
        self.assertNotIn(SECRET,str(gateway.config))
        self.assertFalse(PaymentIntent.objects.exists())

    def test_binding_denied_by_default_and_roles(self):
        with override_settings(CLOUD_PAYSTACK_TEST_BINDING_ENABLED=False):
            response=self.client.post(self.endpoint,self.body,format="json")
        self.assertEqual(response.status_code,503)
        self.assertFalse(PaymentGateway.objects.exists())
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.endpoint).status_code,403)
        self.assertEqual(self.client.post(self.endpoint,self.body,format="json").status_code,403)

    def test_bound_gateway_fails_on_revocation_rotation_unverified_status(self):
        gateway=PaymentGateway.objects.create(
            code="paystack",name="Paystack (test only)",status="test",test_mode=True,
            config={"provider_vault_connection_id":str(self.conn.pk),"provider_vault_version":1})
        with patch("payments.vault_binding._verified_test_connection",return_value=True),\
             patch("payments.vault_binding.verify_chain",return_value=None):
            self.assertEqual(resolve_paystack_test_key(gateway),SECRET)
            self.conn.current_version=2
            self.conn.save(update_fields=["current_version"])
            self.assertIsNone(resolve_paystack_test_key(gateway))
            self.conn.current_version=1
            self.conn.state="revoked"
            self.conn.save(update_fields=["current_version","state"])
            self.assertIsNone(resolve_paystack_test_key(gateway))
        self.conn.state="draft"
        self.conn.save(update_fields=["state"])
        with patch("payments.vault_binding._verified_test_connection",return_value=False):
            self.assertIsNone(resolve_paystack_test_key(gateway))
        gateway.test_mode=False
        gateway.status="active"
        self.assertIsNone(resolve_paystack_test_key(gateway))

    def test_cannot_replace_unrelated_live_gateway_credentials(self):
        gateway=PaymentGateway.objects.create(
            code="paystack",name="Existing live gateway",status="active",test_mode=False,
            encrypted_secret_key="ciphertext-vault-is-different")
        with patch("payments.vault_binding.connection_database_qualified",return_value=True),\
             patch("payments.vault_binding.check_mutation",return_value=None),\
             patch("payments.vault_binding._verified_test_connection",return_value=True),\
             patch("payments.vault_binding.verify_chain",return_value=None):
            response=self.client.post(self.endpoint,self.body,format="json")
        self.assertEqual(response.status_code,403,response.data)
        gateway.refresh_from_db()
        self.assertFalse(gateway.test_mode)
        self.assertEqual(gateway.encrypted_secret_key,"ciphertext-vault-is-different")
