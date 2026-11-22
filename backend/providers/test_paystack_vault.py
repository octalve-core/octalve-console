"""Paystack read-only encrypted-vault onboarding; never collect money in tests."""
from unittest.mock import Mock, MagicMock, patch
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from providers.connection_specs import validate_secrets, SCHEMAS
from providers.connection_verification import paystack_readback,ProviderReadbackFailed
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from payments.models import PaymentIntent, PaymentGateway

TEST_KEY="sk_test_"+"a"*32
LIVE_KEY="sk_live_"+"b"*32
PASSWORD="synthetic-paysafe-only"
VAULT=Fernet.generate_key().decode()
STEP=Fernet.generate_key().decode()
AUDIT=Fernet.generate_key().decode()


def paystack_session(reply=None,status=200):
    response=MagicMock(status_code=status,headers={})
    response.__enter__=Mock(return_value=response)
    response.__exit__=Mock(return_value=False)
    response.iter_content.return_value=[reply or b'{"status":true,"message":"Balances retrieved","data":[{"currency":"NGN","balance":99999999}]}']
    session=Mock()
    session.get.return_value=response
    session.headers.clear=Mock()
    return session


class PaystackVaultSchemaAndReadbackTests(TestCase):
    def test_test_and_live_keys_are_distinct(self):
        self.assertIn("paystack",SCHEMAS)
        self.assertEqual(SCHEMAS["paystack"]["fields"],{})
        self.assertEqual(validate_secrets("paystack",{"secret_key":TEST_KEY},"test")["secret_key"],TEST_KEY)
        self.assertEqual(validate_secrets("paystack",{"secret_key":LIVE_KEY},"live")["secret_key"],LIVE_KEY)
        for key,env in (
            (LIVE_KEY,"test"),(TEST_KEY,"live"),
            ("pk_test_"+"a"*32,"test"),("sk_test_bad","test"),
            ("rk_test_"+"a"*32,"test")
        ):
            with self.subTest(env=env,key=key[:8]),self.assertRaises(ValidationError):
                validate_secrets("paystack",{"secret_key":key},env)
        with self.assertRaises(ValidationError):
            validate_secrets("paystack",{"secret_key":TEST_KEY,"unexpected":"x"},"test")

    def test_verify_only_gets_fixed_origin_never_exposes_balance_or_key(self):
        session=paystack_session()
        proof=paystack_readback(TEST_KEY,"test",session_factory=lambda:session)
        self.assertEqual(proof,{"authenticated":True,"read_only":True,
                                "payment_collection_enabled":False,"environment":"test"})
        self.assertNotIn(TEST_KEY,str(proof))
        self.assertNotIn("99999999",str(proof))
        self.assertFalse(session.trust_env)
        self.assertEqual(session.get.call_args.args[0],"https://api.paystack.co/balance")
        kwargs=session.get.call_args.kwargs
        self.assertEqual(kwargs["headers"]["Authorization"],"Bearer "+TEST_KEY)
        self.assertTrue(kwargs["verify"])
        self.assertFalse(kwargs["allow_redirects"])
        self.assertTrue(kwargs["stream"])
        self.assertEqual(kwargs["timeout"],(3,8))
        session.close.assert_called_once()

    def test_readback_fails_closed_on_bad_auth_or_invalid_schema(self):
        for kwargs in (
            {"status":401},
            {"reply":b'{"status":false,"data":[]}'},
            {"reply":b'{"status":true,"data":{"balance":100}}'},
            {"reply":b"not-json"},
            {"reply":b"x"*32769},
        ):
            with self.subTest(kwargs=str(kwargs)[:48]),self.assertRaises(ProviderReadbackFailed):
                paystack_readback(TEST_KEY,"test",session_factory=lambda:paystack_session(**kwargs))
        with self.assertRaises(ProviderReadbackFailed):
            paystack_readback(TEST_KEY,"live",session_factory=paystack_session)


@override_settings(
 DEBUG=False,
 CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
 CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=True,
 CLOUD_PROVIDER_CUSTODY_VERIFIED=True,
 CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS="paystack",
 CLOUD_PROVIDER_VAULT_KEY=VAULT,CLOUD_PROVIDER_VAULT_KEY_ID="paystack-ci",
 CLOUD_PROVIDER_AUDIT_KEY=AUDIT,CLOUD_PROVIDER_STEPUP_KEY=STEP,
 CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="")
class PaystackVaultHTTPTests(TestCase):
    def setUp(self):
        U=get_user_model()
        self.owner=U.objects.create_superuser(
            username="paystack_super",email="paystack-super@example.invalid",
            password=PASSWORD,email_verified_at=timezone.now())
        self.client=APIClient()
        self.client.force_authenticate(user=self.owner)
        self.payload={
            "adapter_key":"paystack","label":"Paystack test merchant","environment":"test",
            "public_settings":{},"secrets":{"secret_key":TEST_KEY},
            "confirm_password":PASSWORD,"totp_code":"123456",
        }

    def test_creates_only_encrypted_draft_not_payment_gateway(self):
        with patch("providers.connection_views.connection_database_qualified",return_value=True),\
             patch("providers.connection_views.check_mutation",return_value=None):
            result=self.client.post("/api/providers/connections/",self.payload,format="json")
        self.assertEqual(result.status_code,201,result.data)
        self.assertFalse(result.data["execution_enabled"])
        self.assertNotIn(TEST_KEY,str(result.data))
        row=IntegrationConnection.objects.get(adapter_key="paystack")
        self.assertEqual(row.environment,"test")
        self.assertEqual(row.public_settings,{})
        encrypted=IntegrationCredentialVersion.objects.get(connection=row)
        self.assertNotIn(TEST_KEY,encrypted.ciphertext)
        self.assertNotIn(TEST_KEY,str(row))
        self.assertFalse(PaymentGateway.objects.filter(code="paystack").exists())
        self.assertFalse(PaymentIntent.objects.exists())

        with patch("providers.connection_verification.connection_database_qualified",return_value=True),\
             patch("providers.connection_verification.check_mutation",return_value=None),\
             patch("providers.connection_verification.paystack_readback",return_value={
                "authenticated":True,"read_only":True,"payment_collection_enabled":False,
                "environment":"test"}) as readback:
            verified=self.client.post("/api/providers/connections/"+result.data["id"]+"/verify/",
                                      {"confirm_password":PASSWORD,"totp_code":"654321"},format="json")
        self.assertEqual(verified.status_code,200,verified.data)
        self.assertTrue(verified.data["verified"])
        self.assertFalse(verified.data["execution_enabled"])
        readback.assert_called_once_with(TEST_KEY,"test")
        self.assertFalse(PaymentGateway.objects.filter(code="paystack").exists())

    def test_rejects_mismatched_mode_before_ciphertext_creation(self):
        with patch("providers.connection_views.connection_database_qualified",return_value=True),\
             patch("providers.connection_views.check_mutation",return_value=None):
            result=self.client.post("/api/providers/connections/",
                                    {**self.payload,"environment":"live"},format="json")
        self.assertEqual(result.status_code,400,result.data)
        self.assertFalse(IntegrationConnection.objects.exists())

    def test_missing_custody_gate_cannot_store_any_secret(self):
        with override_settings(CLOUD_PROVIDER_CUSTODY_VERIFIED=False),\
             patch("providers.connection_views.connection_database_qualified",return_value=True):
            result=self.client.post("/api/providers/connections/",self.payload,format="json")
        self.assertEqual(result.status_code,503)
        self.assertFalse(IntegrationCredentialVersion.objects.exists())
