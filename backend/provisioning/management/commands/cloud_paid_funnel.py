"""Operator-only staged paid hosting acceptance. No public HTTP endpoints.

Feature switches default OFF. Commands use private configured provider keys,
never accept raw account usernames, API base URLs or gateway credentials.
Omitting --apply always prevents DB settlement and hosting activation.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from payments.models import PaymentIntent
from payments.readback import verify_gateway_intent, PaymentReadbackRejected
from payments.settlement import settle_verified_intent, SettlementRefused
from provisioning.fulfillment import stage_paid_order, FulfillmentRefused
from provisioning.reconcile import reconcile_verified_hosting, ReconciliationRefused


class Command(BaseCommand):
    help = ("Controlled gateway readback -> recorded settlement -> staged outbox "
            "-> real-existing-hosting reconciliation. Disabled by default.")

    def add_arguments(self, parser):
        choice = parser.add_mutually_exclusive_group(required=True)
        choice.add_argument("--intent-id", type=int)
        choice.add_argument("--order-id", type=int)
        choice.add_argument("--task-id", type=int)
        parser.add_argument("--apply", action="store_true",
                            help="Apply verified DB changes. Omit for read-only or rollback validation.")

    def handle(self, *args, **opts):
        keys = [k for k in ("intent_id", "order_id", "task_id") if opts.get(k) is not None]
        if len(keys) != 1 or opts[keys[0]] < 1:
            raise CommandError("Exactly one positive server-side record ID is required.")
        apply = opts["apply"]
        try:
            if opts.get("intent_id") is not None:
                intent_id = opts["intent_id"]
                if apply:
                    payment, created = settle_verified_intent(intent_id)
                    operation = "SETTLEMENT_RECORDED" if created else "SETTLEMENT_ALREADY_RECORDED"
                    self.stdout.write(self.style.SUCCESS(
                        f"{operation}: transaction_id={payment.pk}"))
                else:
                    intent = PaymentIntent.objects.select_related(
                        "invoice__order", "gateway").get(pk=intent_id)
                    payment = verify_gateway_intent(intent)
                    self.stdout.write(self.style.SUCCESS(
                        f"PAYMENT_READ_ONLY_VERIFIED: gateway={payment.gateway} "
                        f"intent_id={intent_id}"))
            elif opts.get("order_id") is not None:
                if apply:
                    rows = stage_paid_order(opts["order_id"])
                else:
                    # Atomic rollback ensures a dry run has ZERO persisted
                    # Service or ProvisioningTask changes.
                    with transaction.atomic():
                        rows = stage_paid_order(opts["order_id"])
                        transaction.set_rollback(True)
                label = "HOSTING_OUTBOX_STAGED" if apply else "HOSTING_STAGE_DRY_RUN_OK"
                self.stdout.write(self.style.SUCCESS(
                    f"{label}: order_id={opts['order_id']}, item_count={len(rows)}"))
            else:
                verified = reconcile_verified_hosting(opts["task_id"], apply=apply)
                label = "HOSTING_PROVIDER_CONFIRMED_AND_ACTIVATED" if apply else "ACCOUNT_READ_ONLY_VERIFIED"
                self.stdout.write(self.style.SUCCESS(
                    f"{label}: task_id={opts['task_id']}, adapter={verified.adapter}"))
        except (PaymentReadbackRejected, SettlementRefused, FulfillmentRefused,
                ReconciliationRefused, PaymentIntent.DoesNotExist) as exc:
            raise CommandError(str(exc)) from None
