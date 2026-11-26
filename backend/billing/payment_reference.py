"""Read-only customer-facing payment evidence, never settlement authority."""
from payments.domain_pilot_scope import CART, PILOT

def verified_payment_details(invoice):
    if invoice.order_id and invoice.order.client_id != invoice.client_id:
        return None
    if invoice.status == "paid" and invoice.amount_paid == invoice.total:
        rows = list(invoice.transactions.filter(client_id=invoice.client_id, status="successful",
            transaction_type="payment", webhook_verified=True, gateway__test_mode=False,
            amount=invoice.total, currency=invoice.currency).select_related("gateway")[:2])
        if len(rows) == 1:
            tx = rows[0]
            return {"reference": tx.reference, "gateway": tx.gateway.code, "verified_at": tx.paid_at, "test": False}
    if invoice.status != "void" or not invoice.order_id or invoice.order.status != "needs_review":
        return None
    metadata = invoice.order.metadata or {}
    for marker in (CART, PILOT):
        if invoice.metadata.get(marker) is not True:
            continue
        value = metadata.get(marker)
        if not isinstance(value, dict) or not value.get("payment_reference"):
            continue
        intent = invoice.payment_intents.filter(client_id=invoice.client_id, status="completed",
            reference=value["payment_reference"], amount=invoice.total, currency=invoice.currency,
            gateway__code="paystack", gateway__test_mode=True).first()
        if intent:
            return {"reference": intent.reference, "gateway": "paystack",
                    "verified_at": value.get("payment_verified_at"), "test": True}
    return None
