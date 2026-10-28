"""Internal wallet posting authority; no public HTTP mutation is enabled.

All balance changes serialize on the wallet row. An existing nonempty reference
is a replay only when direction, amount and wallet agree; conflicting re-use
is refused. PostgreSQL is required for genuine concurrent row locking.
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction

MAX_AMOUNT = Decimal("9999999999.99")


class LedgerRefused(ValueError):
    pass


def normalized_amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise LedgerRefused("Invalid wallet amount.") from None
    if not amount.is_finite() or not (Decimal("0") < amount <= MAX_AMOUNT):
        raise LedgerRefused("Wallet amount is out of range.")
    if amount.as_tuple().exponent < -2 and amount != amount.quantize(Decimal("0.01")):
        raise LedgerRefused("Wallet amount must not exceed two decimal places.")
    return amount


def post_wallet_entry(wallet, *, direction, amount, description, reference=None,
                      created_by=None, metadata=None):
    from .models import Wallet, WalletLedger

    if direction not in ("credit", "debit"):
        raise LedgerRefused("Unknown wallet movement.")
    amount = normalized_amount(amount)
    if not wallet.pk:
        raise LedgerRefused("Wallet must be stored before posting.")
    if not isinstance(description, str) or not 1 <= len(description.strip()) <= 500:
        raise LedgerRefused("Invalid wallet movement description.")
    if reference is not None and (
        not isinstance(reference, str) or
        not 1 <= len(reference) <= 100 or reference != reference.strip()
    ):
        raise LedgerRefused("Invalid wallet reference.")
    if metadata is not None and not isinstance(metadata, dict):
        raise LedgerRefused("Wallet metadata must be an object.")

    with transaction.atomic():
        row = Wallet.objects.select_for_update().get(pk=wallet.pk)
        if not row.is_active:
            raise LedgerRefused("Wallet is inactive.")
        if reference:
            prior = (WalletLedger.objects.filter(wallet=row, reference=reference)
                     .order_by("id").first())
            if prior:
                if (prior.transaction_type == direction and prior.amount == amount
                        and prior.user_id == row.user_id):
                    wallet.balance = row.balance
                    return row.balance, False
                raise LedgerRefused("Wallet reference already belongs to another movement.")
        before = row.balance
        after = before + amount if direction == "credit" else before - amount
        if after < 0 or after > MAX_AMOUNT:
            raise LedgerRefused("Insufficient balance or wallet limit exceeded.")
        row.balance = after
        row.save(update_fields=["balance", "updated_at"])
        WalletLedger.objects.create(
            wallet=row, user_id=row.user_id, transaction_type=direction,
            amount=amount, balance_before=before, balance_after=after,
            description=description.strip(), reference=reference,
            created_by=created_by, metadata=metadata or {},
        )
        wallet.balance = after
        return after, True
