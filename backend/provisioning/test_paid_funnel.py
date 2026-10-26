"""Synthetic, isolated full funnel through financial settlement and outbox.

Never charges a card, calls a vendor, provisions a hosting account, or opens
OPanel. Database tests prove the high-risk authority transitions remain safe.
"""
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.models import PaymentGateway, PaymentIntent, Transaction
from payments.settlement import SettlementRefused, settle_verified_intent
from providers.models import Provider
from provisioning.fulfillment import FulfillmentRefused, stage_paid_order, planned_hosting_username
from provisioning.reconcile import ReconciliationRefused, reconcile_verified_hosting
from provisioning.account_creation_plan import plan_account_creation, execute_account_creation, CreationPlanRefused
from provisioning.create_attempt import reserve_account_create, execute_remote_create, CreateReservationRefused
from provisioning.vendor_create_contract import compile_account_create
from dataclasses import replace
from provisioning.models import ProvisioningLog
from opanel_bridge.models import VerifiedHostingBinding
from provisioning.models import ProvisioningTask
from services.models import Service
from opanel_bridge.policy import eligible


def vendor_payment(payload, status=200):
    out = Mock(status_code=status, headers={})
    out.raw.read.return_value = json.dumps(payload).encode()
    return out


@override_settings(CLOUD_GATEWAY_READBACK_ENABLED=True,
                   CLOUD_SETTLEMENT_COMMIT_ENABLED=True,
                   CLOUD_FULFILLMENT_STAGING_ENABLED=True)
class PaidHostingFunnelTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            email="funnel@example.test", username="funnelexample", role="client",
            password="synthetic-fixture-only-not-real")
        self.provider = Provider.objects.create(
            name="Approved mock WHM", adapter_type="CpanelAdapter",
            base_url="https://whm.synthetic-provider.test:2087",
            status="active", health_status="healthy",
            test_mode=False, username="resellerapi",
            config={"hosting_account_owner": "resellerops"},
        )
        self.gateway = PaymentGateway.objects.create(
            code="paystack", name="Mock Paystack",
            status="active", test_mode=False,
        )
        self.order = Order.objects.create(
            client=user, currency="NGN", status="pending_payment",
            total=Decimal("0"), source="web",
        )
        self.item = OrderItem.objects.create(
            order=self.order, product_id=1, plan_id=1, billing_cycle_id=1,
            item_type="hosting", description="Verified Hosting Starter",
            domain_name="verified.example.test", quantity=1,
            unit_price=Decimal("2500.00"), subtotal=Decimal("2500.00"),
            cycle_key="1mo", months=1,
            config={"catalog_offer_snapshot": {
                "revision": 1, "plan_id": 1, "currency": "NGN",
                "supplier_provider_id": self.provider.pk,
                "technical_package_id": "verified_starter",
                "price": "2500.00", "setup_fee": "0.00",
                "billing_period": "1mo",
            }},
        )
        self.order.refresh_from_db()
        self.invoice = Invoice.create_from_order(self.order)
        self.intent = PaymentIntent.objects.create(
            invoice=self.invoice, client=user, gateway=self.gateway,
            reference="OLPAY_TEST_12345", amount=self.invoice.total,
            currency="NGN", status="pending",
            expires_at=timezone.now()+timedelta(hours=1),
        )
        self.getter = Mock(return_value=vendor_payment({
            "status": True, "data": {
                "id": 987654321, "domain": "live", "status": "success",
                "reference": self.intent.reference,
                "currency": "NGN", "amount": 250000,
            },
        }))
        self.token = patch.object(PaymentGateway, "get_secret_key",
                                  return_value="sk_live_FixtureOnly_0123456789abcdef")
        self.token.start()
        self.addCleanup(self.token.stop)

    def test_deterministic_account_name_obeys_directadmin_eight_character_limit(self):
        self.assertEqual(planned_hosting_username(1), "oc000001")
        self.assertEqual(planned_hosting_username(35), "oc00000z")
        self.assertEqual(planned_hosting_username(36), "oc000010")
        self.assertNotEqual(planned_hosting_username(36), planned_hosting_username(35))
        self.assertEqual(len(planned_hosting_username(36**6-1)), 8)
        for invalid in (0, -1, 36**6, None, "1", 1.0):
            with self.subTest(id=invalid), self.assertRaises(FulfillmentRefused):
                planned_hosting_username(invalid)

    def test_full_verified_payment_stages_once_without_activating_or_provisioning(self):
        tx, created = settle_verified_intent(self.intent.pk, getter=self.getter)
        self.assertTrue(created)
        self.assertEqual(tx.metadata["verification_source"], "provider_api_verified")
        self.assertFalse(tx.webhook_verified)
        self.invoice.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status, "paid")
        self.assertEqual(self.order.status, "paid")
        first = stage_paid_order(self.order.pk)
        second = stage_paid_order(self.order.pk)
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0][0].pk, second[0][0].pk)
        self.assertEqual(first[0][1].pk, second[0][1].pk)
        service, task = first[0]
        self.assertEqual(service.status, "pending")
        self.assertIsNone(service.provider_identifier)
        self.assertIsNone(service.activated_at)
        self.assertEqual(task.status, "queued")
        self.assertEqual(task.lock_key, f"paid-hosting:order-item:{self.item.pk}:v1")
        self.assertEqual(ProvisioningTask.objects.filter(action="provision").count(), 1)
        self.assertEqual(Service.objects.count(), 1)
        self.assertIsNone(eligible(self.order.client_id, service.pk))
        with self.assertRaises(ValueError):
            task.mark_completed({"provider": "200 OK"})
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        # Exactly-once financial delivery: duplicates return the original
        # locked transaction and never issue another gateway HTTP GET.
        second_tx, created_again = settle_verified_intent(self.intent.pk, getter=self.getter)
        self.assertFalse(created_again)
        self.assertEqual(second_tx.pk, tx.pk)
        self.assertEqual(self.getter.call_count, 1)
        self.assertEqual(Transaction.objects.count(), 1)

    @override_settings(CLOUD_GATEWAY_SANDBOX_READBACK_ENABLED=True,
                       CLOUD_ISOLATED_REVIEW_CONFIRMED=True, DEBUG=True)
    def test_real_test_gateway_readback_cannot_settle_or_stage_hosting(self):
        self.gateway.test_mode = True
        self.gateway.status = "test"
        self.gateway.save(update_fields=["test_mode", "status"])
        sandbox_reply = {
            "status": True, "data": {
                "id": 987654321, "domain": "test", "status": "success",
                "reference": self.intent.reference, "currency": "NGN",
                "amount": 250000,
            },
        }
        with patch.object(PaymentGateway, "get_secret_key",
                          return_value="sk_test_synthetic_fixture_0123456789abcdef"):
            with self.assertRaises(SettlementRefused):
                settle_verified_intent(
                    self.intent.pk, getter=Mock(return_value=vendor_payment(sandbox_reply)))
        self.order.refresh_from_db()
        self.invoice.refresh_from_db()
        self.assertEqual(self.order.status, "pending_payment")
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertFalse(Transaction.objects.exists())
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertFalse(Service.objects.exists())

    def test_outbox_requires_genuine_payment_evidence_and_does_not_accept_paid_flags(self):
        self.invoice.status = "paid"
        self.invoice.amount_paid = self.invoice.total
        self.invoice.paid_at = timezone.now()
        self.invoice.save(update_fields=["status", "amount_paid", "paid_at"])
        self.order.status = "paid"
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=["status", "paid_at"])
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertEqual(Service.objects.count(), 0)

    def test_stale_or_mismatched_gateway_response_refused_without_db_write(self):
        self.getter.return_value = vendor_payment({
            "status": True, "data": {
                "id": 12, "domain": "live", "status": "success",
                "reference": "wrong", "currency": "NGN", "amount": 250000,
            },
        })
        with self.assertRaises(Exception):
            settle_verified_intent(self.intent.pk, getter=self.getter)
        self.invoice.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertEqual(self.order.status, "pending_payment")
        self.assertFalse(Transaction.objects.exists())

    def test_unpublished_or_inconsistent_package_snapshot_cannot_stage(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        self.item.config = {"catalog_offer_snapshot": {
            **self.item.config["catalog_offer_snapshot"], "price": "2.00"}}
        self.item.save(update_fields=["config"])
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertFalse(Service.objects.exists())

    def test_expired_gateway_intent_and_disabled_staging(self):
        self.intent.expires_at = timezone.now()-timedelta(seconds=1)
        self.intent.save(update_fields=["expires_at"])
        with self.assertRaises(Exception):
            settle_verified_intent(self.intent.pk, getter=self.getter)
        with override_settings(CLOUD_FULFILLMENT_STAGING_ENABLED=False):
            with self.assertRaises(FulfillmentRefused):
                stage_paid_order(self.order.pk)

    def test_unsafe_wallet_payment_shortcut_is_disabled_without_debit_or_settlement(self):
        from rest_framework.test import APIClient
        api = APIClient()
        api.force_authenticate(self.order.client)
        reply = api.post(f"/api/billing/invoices/{self.invoice.pk}/pay_with_wallet/")
        self.assertEqual(reply.status_code, 503)
        self.invoice.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertEqual(self.order.status, "pending_payment")
        self.assertFalse(Transaction.objects.exists())

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True,
                       CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED=True)
    def test_durable_attempt_is_single_use_and_never_dispatches_network(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        dry = reserve_account_create(task.pk)
        self.assertFalse(dry.created)
        self.assertEqual(dry.state, "dry_run")
        self.assertEqual(ProvisioningLog.objects.filter(task=task).count(), 0)
        first = reserve_account_create(task.pk, apply=True)
        second = reserve_account_create(task.pk, apply=True)
        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.attempt_id, second.attempt_id)
        self.assertEqual(first.username, second.username)
        self.assertFalse(first.remote_request_sent)
        task.refresh_from_db()
        self.assertEqual(task.status, "pending_confirmation")
        self.assertEqual(task.attempt_count, 1)
        self.assertEqual(task.metadata["remote_create"]["state"], "reserved_no_network")
        self.assertEqual(ProvisioningLog.objects.filter(task=task).count(), 1)
        self.assertFalse(VerifiedHostingBinding.objects.exists())
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        with self.assertRaises(CreateReservationRefused):
            execute_remote_create(task.pk)
        with self.assertRaises(CreationPlanRefused):
            plan_account_creation(task.pk)

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True,
                       CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED=True)
    def test_reserved_account_can_only_be_activated_after_exact_provider_readback(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        reservation = reserve_account_create(task.pk, apply=True)
        provider_reply = {
            "metadata": {"result": 1}, "data": {"acct": [{
                "user": reservation.username, "domain": service.domain_name,
                "owner": "resellerops", "suspended": 0,
            }]}
        }
        reply = Mock(status_code=200, headers={}, content=json.dumps(provider_reply).encode())
        reply.json.return_value = provider_reply
        with override_settings(OPANEL_READBACK_ENABLED=True):
            with patch.dict("os.environ", {
                "CLOUD_INVENTORY_ALLOWED_HOSTS": "whm.synthetic-provider.test"
            }):
                with patch.object(Provider, "get_api_key", return_value="provider-test-key"):
                    reconcile_verified_hosting(
                        task.pk, getter=Mock(return_value=reply), apply=True)
        task.refresh_from_db()
        service.refresh_from_db()
        self.assertEqual(task.status, "completed")
        self.assertEqual(service.provider_identifier, reservation.username)
        self.assertEqual(service.status, "active")
        self.assertEqual(VerifiedHostingBinding.objects.count(), 1)
        with self.assertRaises(CreateReservationRefused):
            reserve_account_create(task.pk, apply=True)

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True,
                       CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED=True)
    def test_mutation_timeout_forces_manual_review_and_prevents_retry(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        reserve_account_create(task.pk, apply=True)
        task.refresh_from_db()
        task.mark_failed("Simulated network timeout: untrusted secret should never be logged")
        task.refresh_from_db()
        self.assertEqual(task.status, "needs_review")
        self.assertEqual(task.last_error_code, "REMOTE_OUTCOME_UNKNOWN")
        self.assertNotIn("untrusted secret", task.last_error)
        self.assertFalse(task.can_retry())
        with self.assertRaises(CreateReservationRefused):
            reserve_account_create(task.pk, apply=True)

    def test_vendor_account_create_contract_compiles_without_network_or_secrets_in_logs(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        plan = plan_account_creation(task.pk)
        whm = compile_account_create(plan)
        self.assertEqual(whm.method, "GET")
        self.assertEqual(whm.path, "/json-api/createacct")
        self.assertEqual(whm.query["username"], task.payload["expected_account"])
        self.assertEqual(whm.query["plan"], "verified_starter")
        self.assertEqual(whm.query["owner"], "resellerops")
        self.assertEqual(whm.query["showpass"], "n")
        self.assertNotIn("password", str(whm.query))
        self.assertNotIn("api_key", repr(whm))
        secret = "StrongSyntheticPassword_fixtures_123456789"
        da = compile_account_create(replace(plan, adapter_type="DirectAdminAdapter"),
                                    make_password=lambda: secret)
        self.assertEqual(da.method, "POST")
        self.assertEqual(da.path, "/CMD_API_ACCOUNT_USER")
        self.assertEqual(da.form["username"], whm.query["username"])
        self.assertEqual(da.form["package"], whm.query["plan"])
        self.assertEqual(da.form["passwd2"], secret)
        self.assertEqual(da.form["notify"], "no")
        self.assertNotIn(secret, repr(da))
        with self.assertRaises(CreationPlanRefused):
            compile_account_create(replace(plan, username="INVALID.USER"))
        with self.assertRaises(CreationPlanRefused):
            compile_account_create(replace(plan, adapter_type="DirectAdminAdapter"),
                                   make_password=lambda: "weak")

    def test_creation_contract_only_from_settled_hosting_and_no_remote_create(self):
        with self.assertRaises(CreationPlanRefused):
            plan_account_creation(0)
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        spec = plan_account_creation(task.pk)
        self.assertEqual(spec.username, task.payload["expected_account"])
        self.assertEqual(len(spec.username), 8)
        self.assertEqual(spec.domain, "verified.example.test")
        self.assertEqual(spec.package, "verified_starter")
        self.assertEqual(spec.reseller_owner, "resellerops")
        self.assertEqual(spec.adapter_type, "CpanelAdapter")
        self.assertFalse(spec.remote_account_creation_enabled)
        with self.assertRaises(CreationPlanRefused):
            execute_account_creation(spec)
        task.payload = {**task.payload, "expected_account": "attacker"}
        task.save(update_fields=["payload"])
        with self.assertRaises(CreationPlanRefused):
            plan_account_creation(task.pk)
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        self.assertFalse(VerifiedHostingBinding.objects.exists())

    def test_unhealthy_provider_cannot_be_staged(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        self.provider.health_status = "unhealthy"
        self.provider.save(update_fields=["health_status"])
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertFalse(ProvisioningTask.objects.exists())

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True,
                       OPANEL_READBACK_ENABLED=True,
                       OPANEL_ISSUER_ENABLED=True,
                       OPANEL_CLIENT_SECRET="synthetic-opanel-secret-0123456789abcdef",
                       OPANEL_CLIENT_ID="octalve-opanel",
                       OPANEL_CALLBACK_URL="https://panel.example.test/auth/callback/")
    def test_provider_reconciliation_then_opanel_customer_launch(self):
        import base64
        import hashlib
        from rest_framework.test import APIClient
        payment, _ = settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        account = task.payload["expected_account"]
        provider_reply = {
            "metadata": {"result": 1}, "data": {"acct": [{
                "user": account, "domain": "verified.example.test",
                "owner": "resellerops", "suspended": 0,
            }]}
        }
        reply = Mock(status_code=200, headers={}, content=json.dumps(provider_reply).encode())
        reply.json.return_value = provider_reply
        getter = Mock(return_value=reply)
        with patch.dict("os.environ", {"CLOUD_INVENTORY_ALLOWED_HOSTS": "whm.synthetic-provider.test"}):
            with patch.object(Provider, "get_api_key", return_value="provider-test-key"):
                # Dry run never creates a service authority.
                reconcile_verified_hosting(task.pk, getter=getter)
                service.refresh_from_db()
                self.assertEqual(service.status, "pending")
                self.assertFalse(VerifiedHostingBinding.objects.exists())
                reconcile_verified_hosting(task.pk, getter=getter, apply=True)
        service.refresh_from_db()
        self.order.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(service.status, "active")
        self.assertEqual(service.provider_identifier, account)
        self.assertEqual(task.status, "completed")
        self.assertEqual(self.order.status, "provisioned")
        self.assertIsNotNone(eligible(service.client_id, service.pk))
        self.assertEqual(VerifiedHostingBinding.objects.count(), 1)
        with self.assertRaises(ReconciliationRefused):
            reconcile_verified_hosting(task.pk, getter=getter, apply=True)
        # The existing Console issuer grants OPanel only after that proof.
        verifier = "x" * 50
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        api = APIClient()
        api.force_authenticate(self.order.client)
        path = "/api/integrations/opanel/v1/"
        issued = api.post(path + "authorize/", {
            "service_id": service.pk, "state": "s" * 32,
            "code_challenge": challenge,
        }, format="json")
        self.assertEqual(issued.status_code, 200, getattr(issued, "data", {}))
        anonymous = APIClient()
        exchanged = anonymous.post(path + "exchange/", {
            "code": issued.data["code"], "code_verifier": verifier,
            "redirect_uri": "https://panel.example.test/auth/callback/",
        }, format="json",
            HTTP_X_OPANEL_CLIENT_ID="octalve-opanel",
            HTTP_AUTHORIZATION="Bearer synthetic-opanel-secret-0123456789abcdef")
        self.assertEqual(exchanged.status_code, 200, getattr(exchanged, "data", {}))
        self.assertEqual(exchanged.data["service_id"], service.pk)

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True, OPANEL_READBACK_ENABLED=True)
    def test_provider_account_wrong_reseller_cannot_activate_or_create_opanel_proof(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        wrong = {"metadata": {"result": 1}, "data": {"acct": [{
            "user": task.payload["expected_account"],
            "domain": "verified.example.test",
            "owner": "other-reseller", "suspended": 0,
        }]}}
        reply = Mock(status_code=200, content=json.dumps(wrong).encode())
        reply.json.return_value = wrong
        with patch.dict("os.environ", {"CLOUD_INVENTORY_ALLOWED_HOSTS": "whm.synthetic-provider.test"}):
            with patch.object(Provider, "get_api_key", return_value="provider-test-key"):
                with self.assertRaises(ReconciliationRefused):
                    reconcile_verified_hosting(task.pk, getter=Mock(return_value=reply), apply=True)
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        self.assertIsNone(service.provider_identifier)
        self.assertFalse(VerifiedHostingBinding.objects.exists())
