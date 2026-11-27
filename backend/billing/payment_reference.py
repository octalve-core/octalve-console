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
    from payments.customer_test_evidence import test_payment_evidence
    proof=test_payment_evidence(invoice)
    if proof:
        return {key:proof[key] for key in ("reference","gateway","verified_at","test")}
    return None
