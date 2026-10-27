"""Offline Batch 13.2 reward-economics qualification; NOT a redemption endpoint.

All inputs must be server-verified snapshots of supplier prices and costs.
No caller may use this to mutate orders, invoices, payments, wallets or points.
Activating checkout redemption needs an independent atomic reservation workflow.
"""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_DOWN

RATE_CAP = Decimal("0.05")
NAIRA_CAP = Decimal("2500.00")
MIN_MARGIN = Decimal("0.20")
PENNY = Decimal("0.01")


@dataclass(frozen=True)
class FinancialQualification:
    allowed: bool
    reason: str
    maximum_reward_ngn: Decimal
    post_reward_net_ngn: Decimal
    contribution_ngn: Decimal
    contribution_margin: Decimal


def _amount(value):
    if isinstance(value, bool) or not isinstance(value, Decimal):
        raise ValueError("A verified Decimal amount is required")
    if not value.is_finite() or value < 0 or value != value.quantize(PENNY):
        raise ValueError("Invalid nonnegative NGN amount")
    return value


def qualify_reward_discount(
    *, currency, price_excluding_tax, existing_discounts,
    reward_discount, supplier_cost, gateway_fee, affiliate_cost,
):
    """Conservatively evaluate a candidate; never authorize actual redemption.

    Margin uses net pre-tax revenue after all reductions and known costs.
    Unknown fee, cost, tax treatment, or FX conversion must fail closed.
    """
    if currency != "NGN":
        return FinancialQualification(False, "Only verified NGN quotes supported",
            Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00"))
    price = _amount(price_excluding_tax)
    coupon = _amount(existing_discounts)
    reward = _amount(reward_discount)
    supplier = _amount(supplier_cost)
    fee = _amount(gateway_fee)
    affiliate = _amount(affiliate_cost)
    if price <= 0 or coupon >= price:
        return FinancialQualification(False,"No eligible positive pre-tax revenue",
            Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00"))
    basis = price - coupon
    cap = min((basis * RATE_CAP).quantize(PENNY,rounding=ROUND_DOWN),NAIRA_CAP)
    net = basis - reward
    cost = supplier + fee + affiliate
    contribution = net - cost
    ratio = (contribution / net) if net > 0 else Decimal("-1")
    allowed = bool(
        reward > 0 and reward <= cap and net > 0 and
        contribution >= 0 and ratio >= MIN_MARGIN
    )
    reason = (
        "Conservative price and margin conditions passed; checkout still disabled"
        if allowed else "Reward would exceed value cap or minimum net margin"
    )
    return FinancialQualification(
        allowed,reason,cap,net,contribution,ratio,
    )
