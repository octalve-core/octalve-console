"""LAUNCH-02 read-only sandbox supplier and pricing qualification.

No registrar mutation, DNS write, invoice issuance, payment or entitlement.
The same vault and pinned sandbox binding used by the existing pilot is used
for fresh evidence. No browser-supplied supplier URLs or credentials.
"""
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db import DatabaseError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError, NotFound
from billing.models import Invoice
from billing.payment_reference import verified_payment_details
from payments.domain_pilot_scope import CART, PILOT, pilot_gateway_allowed
from payments.hosted_checkout import payment_history, CheckoutRefused
from payments.models import WebhookEvent
from providers.cloudflare_int01 import require_domain, CloudflareINT01Denied
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_status import safe_verification_status, verification_receipts
from providers.connection_vault import VaultUnavailable
from .models import TLDPricing
from .tld_pricing_admin import rate_card_draft, TERMS
from .pilot import registrar

def price_review(row):
    draft=rate_card_draft(row)
    published=row.metadata.get("published_registrar") if isinstance(row.metadata,dict) else None
    published=published if isinstance(published,dict) and type(published.get("revision")) is int and row.status=="active" else None
    return {"tld":row.tld,"currency":"NGN","published_revision":published["revision"] if published else None,
        "draft_revision":draft["revision"],"published": {
            "registration":str(row.register_price),"renewal":str(row.renewal_price),
        } if published else None,
        "terms":[{"years":int(term),"registration_draft":draft["registration"][term],
                  "renewal_draft":draft["renewal"][term],
                  "test_checkout_qualified":bool(published and row.tld==".com" and term=="1" and row.register_price>0)}
                 for term in TERMS],
        "transfer_draft":draft["transfer_price"],"transfer_executable":False,
        "renewal_executable":False,"live_execution_enabled":False}

def supplier_status():
    rows=list(IntegrationConnection.objects.filter(adapter_key__in=("cloudflare-registrar","cloudflare-registrar-live","resellerclub","cloudflare-dns"),state="draft").order_by("adapter_key","environment","pk")[:50])
    receipts=verification_receipts(rows)
    return [{"adapter":r.adapter_key,"environment":r.environment,"label":r.label,
             "credential_version":r.current_version,
             "verification_status":safe_verification_status(r,receipts)["verification_status"],
             "execution_enabled":False} for r in rows]

def sandbox_quote(domain):
    domain=require_domain(domain)
    adapter,_=registrar()
    proof=adapter.check(domain)
    if proof.get("name")!=domain:
        raise CloudflareINT01Denied()
    checked=timezone.now()
    row=TLDPricing.objects.filter(tld="."+domain.rsplit(".",1)[1]).first()
    terms=[]
    if proof.get("registrable") is True:
        first=Decimal(proof["registration_cost"])
        renewal=Decimal(proof["renewal_cost"])
        # Cost arithmetic only, never term eligibility or a retail checkout quote.
        terms=[{"years":int(n),"supplier_registration_cost":str(first+(int(n)-1)*renewal),
                "supplier_renewal_cost":str(int(n)*renewal),"term_eligibility_verified":False} for n in TERMS]
    return {"mode":"sandbox_readback","domain":domain,"availability":proof,"supplier_terms":terms,
            "retail":price_review(row) if row else None,"checked_at":checked.isoformat(),
            "expires_at":(checked+timezone.timedelta(minutes=5)).isoformat(),
            "checkout_enabled":False,"execution_enabled":False}

def registration_review(invoice, domain):
    """Read only an exact, verified historical sandbox order and pinned name."""
    if not invoice.order_id or invoice.status!="void" or invoice.client_id!=invoice.order.client_id:
        raise NotFound()
    order=invoice.order
    if order.status!="needs_review" or (verified_payment_details(invoice) or {}).get("test") is not True:
        raise NotFound()
    marker=PILOT if invoice.metadata.get(PILOT) is True else CART if invoice.metadata.get(CART) is True else None
    state=order.metadata.get(marker)
    if not isinstance(state,dict) or state.get("public_payment_test") is True:
        raise NotFound()
    name=require_domain(domain)
    if marker==PILOT:
        snapshot=state
        if snapshot.get("domain")!=name or snapshot.get("state")!="registered":
            raise NotFound()
    else:
        lines=list(order.items.filter(item_type="domain",domain_name=name)[:2])
        if len(lines)!=1:
            raise NotFound()
        snapshot=lines[0].config.get(CART,{})
        if snapshot.get("domain")!=name or snapshot.get("state")!="registered":
            raise NotFound()
    try:
        intent,_=payment_history(invoice)
    except CheckoutRefused:
        raise ValidationError("Payment history requires review.") from None
    if (not intent or intent.status!="completed" or not pilot_gateway_allowed(intent.gateway,invoice)
            or state.get("payment_reference")!=intent.reference or not state.get("payment_remote_id")
            or not WebhookEvent.objects.filter(gateway_id=intent.gateway_id,is_verified=True,is_processed=True,
                event_type="charge.success",payload__intent_id=intent.pk,payload__reference=intent.reference,
                payload__remote_id=state["payment_remote_id"]).exists()):
        raise ValidationError("Processed independent payment evidence is required.")
    adapter,_=registrar(snapshot)
    result=adapter.get_registration(name)
    if result.get("domain_name")!=name:
        raise CloudflareINT01Denied()
    expiry=parse_datetime(result.get("expires_at") or "")
    days=(expiry-timezone.now()).days if expiry and expiry.utcoffset() is not None else None
    return {"mode":"sandbox_readback","domain":name,"registration":result,
            "days_until_expiry":days,"checked_at":timezone.now().isoformat(),
            "renewal_state":"review_required","transfer_state":"review_required",
            "dns_state":"no_sandbox_dns_zone","execution_enabled":False}
