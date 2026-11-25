"""Read confirmed registration and activation dates without modifying invoice totals."""


def confirmed_period(item):
    order = item.invoice.order
    if order and item.domain_name and isinstance(order.metadata, dict):
        purchase = order.metadata.get("sandbox_domain_purchase", {})
        if (isinstance(purchase, dict) and purchase.get("state") == "registered"
                and purchase.get("domain") == item.domain_name):
            registration = purchase.get("registration") or {}
            if isinstance(registration, dict) and registration.get("registered_at") and registration.get("expires_at"):
                return {"start": registration["registered_at"], "end": registration["expires_at"], "kind": "domain"}
    evidence = item.metadata.get("confirmed_period") if isinstance(item.metadata, dict) else None
    return evidence if isinstance(evidence, dict) else None
