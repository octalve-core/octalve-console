"""Batch B lifecycle regressions on synthetic local records only."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import importlib.util
import threading
import unittest

DJANGO_AVAILABLE = importlib.util.find_spec("django") is not None
if DJANGO_AVAILABLE:
    from django.contrib.auth import get_user_model
    from django.db import connection, close_old_connections
    from django.test import TestCase, TransactionTestCase
    from django.utils import timezone
    from rest_framework.test import APIClient
    from wallet.models import Wallet, WalletLedger
    from wallet.ledger_authority import LedgerRefused
    from provisioning.models import ProvisioningTask, ProvisioningLog
    from provisioning.task_transitions import transition_task, TaskTransitionRefused
    from services.models import Service, ServiceActionLog, ServiceChangeRequest
    from services.lifecycle_requests import request_service_cancellation
    from settings_registry.models import Setting, SettingGroup, SettingChangeLog
else:
    TestCase = unittest.TestCase
    TransactionTestCase = unittest.TestCase


def create_owner(name="owner", role="client", superuser=False):
    user = get_user_model().objects.create_user(
        email=name + "@example.test", username=name,
        password="test-only-fixture-password", role=role,
    )
    if superuser:
        user.is_superuser = True
        user.is_staff = True
        user.save(update_fields=["is_superuser", "is_staff"])
    return user


def create_service(owner, status="active"):
    return Service.objects.create(
        client=owner, product_id=1, plan_id=1, service_type="hosting",
        status=status, label="Owned synthetic hosting", domain_name="example.test",
        billing_cycle="1mo", amount=Decimal("5000"), currency="NGN",
        next_due_date=timezone.now() + timezone.timedelta(days=30),
    )


@unittest.skipUnless(DJANGO_AVAILABLE, "Django suite")
class BatchBWalletTests(TestCase):
    def setUp(self):
        self.owner = create_owner()
        self.wallet, _ = Wallet.objects.get_or_create(user=self.owner)

    def test_idempotent_same_reference_and_conflicting_replay(self):
        first = self.wallet.add_balance(Decimal("50.00"), "Test credit", reference="test-credit-1")
        second = self.wallet.add_balance(Decimal("50.00"), "Test credit", reference="test-credit-1")
        self.assertEqual(first, Decimal("50"))
        self.assertEqual(second, first)
        self.assertEqual(WalletLedger.objects.filter(wallet=self.wallet).count(), 1)
        with self.assertRaises(LedgerRefused):
            self.wallet.add_balance(Decimal("60"), "Different credit", reference="test-credit-1")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("50"))

    def test_debit_and_replay_have_single_ledger_history(self):
        self.wallet.add_balance(Decimal("100.00"), "Fixture", reference="credit-one")
        self.wallet.deduct_balance(Decimal("35.00"), "Fixture", reference="debit-one")
        self.wallet.deduct_balance(Decimal("35.00"), "Fixture", reference="debit-one")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("65.00"))
        self.assertEqual(WalletLedger.objects.filter(wallet=self.wallet).count(), 2)

    def test_overdraft_invalid_precision_and_inactive_wallet_refused(self):
        for amount in ("0", "-1", "0.001", "NaN", "Infinity"):
            with self.subTest(amount=amount):
                with self.assertRaises(LedgerRefused):
                    self.wallet.add_balance(amount, "Fixture")
        with self.assertRaises(LedgerRefused):
            self.wallet.deduct_balance(Decimal("1"), "Overdraft")
        self.wallet.is_active = False
        self.wallet.save(update_fields=["is_active"])
        with self.assertRaises(LedgerRefused):
            self.wallet.add_balance(Decimal("10"), "Inactive")
        self.assertFalse(WalletLedger.objects.filter(wallet=self.wallet).exists())

    def test_existing_ledger_is_application_append_only(self):
        self.wallet.add_balance(Decimal("20"), "Fixture", reference="immutable-test")
        entry = WalletLedger.objects.get(wallet=self.wallet)
        entry.description = "Changed"
        with self.assertRaises(ValueError):
            entry.save()
        with self.assertRaises(ValueError):
            entry.delete()
        with self.assertRaises(ValueError):
            WalletLedger.objects.filter(pk=entry.pk).update(description="Changed")
        with self.assertRaises(ValueError):
            WalletLedger.objects.filter(pk=entry.pk).delete()


@unittest.skipUnless(DJANGO_AVAILABLE, "Django suite")
class BatchBTaskAndServiceTests(TestCase):
    def setUp(self):
        self.owner = create_owner()
        self.admin = create_owner("operator", role="admin", superuser=True)
        self.stranger = create_owner("stranger")
        self.service = create_service(self.owner)

    def test_read_only_retry_logs_exactly_one_transition(self):
        task = ProvisioningTask.objects.create(
            service=self.service, adapter_type="CpanelAdapter",
            action="sync_usage", status="failed", attempt_count=1, max_attempts=3,
        )
        state = transition_task(task.pk, decision="retry", actor=self.admin)
        self.assertEqual(state.status, "queued")
        self.assertEqual(ProvisioningLog.objects.filter(task=task, step="manual_state_transition").count(), 1)
        with self.assertRaises(TaskTransitionRefused):
            transition_task(task.pk, decision="retry", actor=self.admin)

    def test_unknown_provider_outcome_cannot_be_cancelled_or_retried(self):
        task = ProvisioningTask.objects.create(
            service=self.service, adapter_type="CpanelAdapter",
            action="provision", status="retrying",
        )
        for decision in ("retry", "cancel"):
            with self.assertRaises(TaskTransitionRefused):
                transition_task(task.pk, decision=decision, actor=self.admin)
        task.refresh_from_db()
        self.assertEqual(task.status, "retrying")

    def test_mark_review_refuses_terminal_state_and_invalid_reason(self):
        task = ProvisioningTask.objects.create(
            service=self.service, adapter_type="CpanelAdapter",
            action="provision", status="queued",
        )
        entry = transition_task(task.pk, decision="needs_review", actor=self.admin, reason="Operator review")
        self.assertEqual(entry.status, "needs_review")
        with self.assertRaises(TaskTransitionRefused):
            transition_task(task.pk, decision="needs_review", actor=self.admin)
        with self.assertRaises(TaskTransitionRefused):
            transition_task(task.pk, decision="needs_review", actor=self.admin, reason="x"*241)

    def test_service_cancel_request_is_idempotent_and_non_executing(self):
        entry, created = request_service_cancellation(self.service.pk, actor=self.owner)
        again, created_again = request_service_cancellation(self.service.pk, actor=self.owner)
        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(entry.pk, again.pk)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, "active")
        self.assertEqual(ServiceActionLog.objects.filter(service=self.service, action="cancel").count(), 1)

    def test_customer_cancel_endpoint_owner_gate_and_no_vendor_mutation(self):
        api = APIClient()
        api.force_authenticate(user=self.stranger)
        refused = api.post(f"/api/services/services/{self.service.pk}/request-cancellation/",
                           {"reason":"Review request"}, format="json")
        self.assertEqual(refused.status_code, 404)
        api.force_authenticate(user=self.owner)
        reply = api.post(f"/api/services/services/{self.service.pk}/request-cancellation/",
                         {"reason":"Review request"}, format="json")
        self.assertEqual(reply.status_code, 202)
        self.assertFalse(reply.data["provider_action_taken"])
        repeat = api.post(f"/api/services/services/{self.service.pk}/request-cancellation/",
                          {"reason":"Review request"}, format="json")
        self.assertEqual(repeat.status_code, 202)
        self.assertFalse(repeat.data["created"])
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, "active")

    def test_legacy_change_complete_cannot_mutate_service_price(self):
        change = ServiceChangeRequest.objects.create(
            service=self.service, change_type="upgrade", current_plan_id=1,
            new_plan_id=2, current_price=Decimal("5000"), new_price=Decimal("9000"),
        )
        with self.assertRaises(ValueError):
            change.complete()
        self.service.refresh_from_db()
        self.assertEqual(self.service.plan_id, 1)
        self.assertEqual(self.service.amount, Decimal("5000"))


@unittest.skipUnless(DJANGO_AVAILABLE, "Django suite")
class BatchBSettingsReviewTests(TestCase):
    def setUp(self):
        self.admin = create_owner("super", role="admin", superuser=True)
        self.client_user = create_owner()
        self.group = SettingGroup.objects.create(key="general", name="General")
        self.setting = Setting.objects.create(
            group=self.group, key="company_name", name="Company name",
            value="Original Octalve", data_type="string",
        )

    def test_super_admin_can_validate_without_applying_a_change(self):
        api = APIClient()
        api.force_authenticate(user=self.admin)
        url = f"/api/settings/settings/{self.setting.pk}/validate-change/"
        response = api.post(url, {"value":"Octalve Cloud"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["requires_approval"])
        self.assertFalse(response.data["applied"])
        self.assertNotIn("value", response.data)
        self.setting.refresh_from_db()
        self.assertEqual(self.setting.value, "Original Octalve")
        self.assertFalse(SettingChangeLog.objects.exists())

    def test_clients_or_secret_changes_cannot_pass_review(self):
        api = APIClient()
        url = f"/api/settings/settings/{self.setting.pk}/validate-change/"
        api.force_authenticate(user=self.client_user)
        self.assertEqual(api.post(url, {"value":"Change"}, format="json").status_code, 403)
        api.force_authenticate(user=self.admin)
        self.setting.is_encrypted = True
        self.setting.save(update_fields=["is_encrypted"])
        self.assertEqual(api.post(url, {"value":"Change"}, format="json").status_code, 400)


@unittest.skipUnless(DJANGO_AVAILABLE, "Django suite")
class BatchBPostgresConcurrentWalletTests(TransactionTestCase):
    """True concurrent transactions require row locks, not SQLite's no-op locks."""

    def test_concurrent_duplicate_reference_creates_one_credit(self):
        if connection.vendor != "postgresql":
            self.skipTest("Real row-lock acceptance requires PostgreSQL.")
        owner = create_owner("concurrent")
        wallet, _ = Wallet.objects.get_or_create(user=owner)
        barrier = threading.Barrier(2)

        def worker():
            close_old_connections()
            try:
                local_wallet = Wallet.objects.get(pk=wallet.pk)
                barrier.wait(timeout=12)
                return local_wallet.add_balance(
                    Decimal("100.00"), "Synthetic concurrent credit",
                    reference="single-concurrent-ref",
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _i: worker(), range(2)))
        wallet.refresh_from_db()
        self.assertEqual(results, [Decimal("100"), Decimal("100")])
        self.assertEqual(wallet.balance, Decimal("100"))
        self.assertEqual(WalletLedger.objects.filter(wallet=wallet).count(), 1)

    def test_competing_debits_do_not_overdraw_wallet(self):
        if connection.vendor != "postgresql":
            self.skipTest("Real row-lock acceptance requires PostgreSQL.")
        owner = create_owner("competingdebit")
        wallet, _ = Wallet.objects.get_or_create(user=owner)
        wallet.add_balance(Decimal("100"), "Synthetic preload", reference="preload")
        barrier = threading.Barrier(2)

        def worker(number):
            close_old_connections()
            try:
                row = Wallet.objects.get(pk=wallet.pk)
                barrier.wait(timeout=12)
                try:
                    row.deduct_balance(Decimal("70"), "Synthetic debit", reference=f"debit-{number}")
                    return "committed"
                except LedgerRefused:
                    return "refused"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(worker, (1, 2)))
        wallet.refresh_from_db()
        self.assertEqual(sorted(outcomes), ["committed", "refused"])
        self.assertEqual(wallet.balance, Decimal("30"))
        self.assertEqual(WalletLedger.objects.filter(wallet=wallet).count(), 2)

    def test_simultaneous_service_cancellation_requests_are_idempotent(self):
        if connection.vendor != "postgresql":
            self.skipTest("Real row-lock acceptance requires PostgreSQL.")
        owner = create_owner("concurrentcancel")
        service = create_service(owner)
        barrier = threading.Barrier(2)

        def worker():
            close_old_connections()
            try:
                barrier.wait(timeout=12)
                _entry, created = request_service_cancellation(service.pk, actor=owner)
                return created
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _i: worker(), range(2)))
        self.assertEqual(sorted(outcomes), [False, True])
        service.refresh_from_db()
        self.assertEqual(service.status, "active")
        self.assertEqual(ServiceActionLog.objects.filter(
            service=service, action="cancel", details__state="pending_review"
        ).count(), 1)
