"""Internal, side-effect-free preflight for payment-triggered provisioning.

Never infer payment from a browser redirect, invoice.status alone, or user
controlled data. The future signed gateway settlement transaction must explicitly
carry the verifier's provenance. This file DOES NOT transfer money, call a
provider, activate hosting or schedule an unqualified worker.
"""
from dataclasses import dataclass
from decimal import Decimal


class SettlementNotVerified(ValueError):
    pass


@dataclass(frozen=True)
class ProvisioningDecision:
    approved: bool
    reason: str


VERIFIED_SOURCES = frozenset({'signed_webhook_and_api_verification', 'provider_api_verified'})
ELIGIBLE_GATEWAYS = frozenset({'paystack', 'flutterwave'})


def evaluate_payment_to_provisioning(invoice, transaction):
    """Pure decision: all inputs must come from server-trusted DB records."""
    def decline(reason):
        return ProvisioningDecision(False, reason)

    if not invoice or not transaction or not invoice.order:
        return decline('Order, invoice and transaction must all exist.')
    order = invoice.order
    if invoice.client_id != order.client_id or transaction.client_id != invoice.client_id:
        return decline('Financial ownership mismatch.')
    if transaction.invoice_id != invoice.pk:
        return decline('Transaction is not attached to this invoice.')
    if invoice.status != 'paid' or order.status != 'paid':
        return decline('Invoice and order are not settled.')
    if invoice.paid_at is None or order.paid_at is None:
        return decline('Settlement timestamps are missing.')
    if Decimal(str(invoice.amount_due)) != 0 or Decimal(str(invoice.amount_paid)) < Decimal(str(invoice.total)):
        return decline('Invoice is not fully settled.')
    if not invoice.total or Decimal(str(invoice.total)) <= 0:
        return decline('Invalid invoice amount.')
    if invoice.currency != order.currency or invoice.currency != transaction.currency:
        return decline('Payment currencies do not agree.')
    if transaction.transaction_type != 'payment' or transaction.status != 'successful':
        return decline('No successful settled payment transaction.')
    if not transaction.webhook_verified or transaction.paid_at is None:
        return decline('Payment was not independently verified.')
    if transaction.gateway is None or transaction.gateway.status != 'active' or transaction.gateway.test_mode:
        return decline('Payment gateway is inactive or in test mode.')
    if transaction.gateway.code not in ELIGIBLE_GATEWAYS:
        return decline('This gateway has no approved automatic-settlement adapter.')
    if transaction.metadata.get('verification_source') not in VERIFIED_SOURCES:
        return decline('No accepted server-side verification provenance.')
    if Decimal(str(transaction.amount)) < Decimal(str(invoice.total)):
        return decline('Verified transaction does not cover the invoice.')
    return ProvisioningDecision(True, 'Eligible for a separately authorised provisioning worker.')


def require_verified_settlement(invoice, transaction):
    decision = evaluate_payment_to_provisioning(invoice, transaction)
    if not decision.approved:
        raise SettlementNotVerified(decision.reason)
    return decision
