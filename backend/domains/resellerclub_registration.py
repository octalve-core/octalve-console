"""Staged ResellerClub customer/contact/domain fulfillment.

Each external creation is preceded by a committed durable reservation. Unknown
results are recovered by independent exact identity readback, never reposted.
"""
import secrets
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from audit.models import AuditLog
from billing.models import Invoice
from orders.models import Order
from providers.connection_models import IntegrationConnection
from providers.registrar_live_policy import load,policy
from .models import Domain,DomainNameserver
from .live_registration import KEY,authority,RegistrationRefused,account_id

def update(domain,entry,grant,invoice,row,secret,changes):
    with transaction.atomic():
        Invoice.objects.select_for_update().get(pk=invoice.pk)
        locked=Domain.objects.select_for_update().get(pk=domain.pk)
        current,g,_=authority(locked,lock=True)
        IntegrationConnection.objects.select_for_update().get(pk=row.pk)
        if current!=entry or g!=grant or load(grant["route"])[1]!=secret:
            raise RegistrationRefused("Registrar authority changed.")
        new={**entry,**changes}
        locked.metadata={**locked.metadata,KEY:new}
        locked.save(update_fields=["metadata","updated_at"])
        AuditLog.objects.create(actor=None,action="resellerclub_registration_stage",entity_type="Domain",
            entity_id=str(locked.pk),entity_name=locked.domain_name,details={"stage":new.get("rc_stage"),"order":grant["order"]})
    return new

def advance(domain,entry,grant,invoice,row,secret,adapter):
    config=policy(row)
    if not config or entry["state"] not in ("queued","uncertain"):
        return "held"
    stage=entry.get("rc_stage")
    contact=domain.registrant_contact
    if stage in (None,"customer_reserved"):
        customer=adapter.customer(contact)
        if customer:
            update(domain,entry,grant,invoice,row,secret,{"state":"uncertain","rc_stage":"customer_ready","rc_customer":customer})
            return "processed"
        if stage=="customer_reserved":
            return "held"
        update(domain,entry,grant,invoice,row,secret,{"state":"uncertain","rc_stage":"customer_reserved"})
        if load(grant["route"])[1]==secret:
            adapter.create_customer(contact,"Aa1!"+secrets.token_urlsafe(30))
        return "processed"
    if stage in ("customer_ready","contact_reserved"):
        customer=entry["rc_customer"]
        if adapter.customer(contact)!=customer:
            return "held"
        cid=adapter.find_contact(customer,contact)
        if cid:
            update(domain,entry,grant,invoice,row,secret,{"rc_stage":"contact_ready","rc_contact":cid})
            return "processed"
        if stage=="contact_reserved":
            return "held"
        update(domain,entry,grant,invoice,row,secret,{"rc_stage":"contact_reserved"})
        if load(grant["route"])[1]==secret:
            adapter.create_contact(customer,contact)
        return "processed"
    if stage=="contact_ready":
        if adapter.domain_details(domain.domain_name,missing=True) is not None:
            return "held"
        if adapter.customer(contact)!=entry["rc_customer"] or adapter.find_contact(entry["rc_customer"],contact)!=entry["rc_contact"]:
            return "held"
        transfer=grant.get("operation")=="transfer"
        fresh=adapter.standard_transfer(domain.domain_name) if transfer else adapter.live_domain_check(domain.domain_name)
        if (fresh.get("registrable") is not True or fresh.get("name")!=domain.domain_name
            or fresh.get("currency")!=grant["cost"]["currency"]
            or Decimal(fresh["transfer_cost" if transfer else "registration_cost"])>Decimal(grant["supplier_amount"])):
            return "held"
        entry=update(domain,entry,grant,invoice,row,secret,{"rc_stage":"registration_reserved","reserved_at":timezone.now().isoformat(),
            "rc_nameservers":config["nameservers"]})
        if load(grant["route"])[1]==secret:
            if transfer:
                from .transfer_secret import open_code
                adapter.transfer(domain.domain_name,entry["rc_customer"],entry["rc_contact"],open_code(domain),entry["rc_nameservers"])
            else:
                adapter.register(domain.domain_name,entry["rc_customer"],entry["rc_contact"],entry["rc_nameservers"])
        return "processed"
    if stage!="registration_reserved":
        return "held"
    proof=adapter.domain_details(domain.domain_name,customer=entry["rc_customer"],contact=entry["rc_contact"],missing=True)
    if not proof or proof["status"] not in ("Active","Pending Verification","Failed Verification","Suspended"):
        return "held"
    created=parse_datetime(proof["registered_at"]);expires=parse_datetime(proof["expires_at"])
    reserved=parse_datetime(entry["reserved_at"])
    if (proof.get("domain_name")!=domain.domain_name or not created or not expires or not reserved
        or created<reserved-timedelta(minutes=5) or created>timezone.now()+timedelta(minutes=5)
        or expires<created+relativedelta(years=1)-timedelta(days=1)
        or proof.get("auto_renew") is not False or proof.get("premium") is not False
        or proof.get("registrant_email")!=contact["email"]):
        return "held"
    with transaction.atomic():
        Invoice.objects.select_for_update().get(pk=invoice.pk)
        locked=Domain.objects.select_for_update().get(pk=domain.pk)
        fresh,g,_=authority(locked,lock=True)
        if fresh!=entry or g!=grant or load(grant["route"])[1]!=secret:
            return "held"
        locked.registration_date=created;locked.expiry_date=expires;locked.next_due_date=expires
        locked.status="active" if proof["status"]=="Active" else ("pending" if proof["status"]=="Pending Verification" else "suspended")
        locked.is_active=locked.status=="active";locked.provider_domain_id=proof["order_id"]
        locked.epp_code=None;locked.epp_code_encrypted=None
        locked.metadata={**locked.metadata,KEY:{**entry,"state":"confirmed","rc_stage":"confirmed",
            "registrant_verification":proof["registrant_verification"],"confirmed_at":timezone.now().isoformat()}}
        locked.save()
        if proof["nameservers"]:
            DomainNameserver.objects.filter(domain=locked).delete()
            DomainNameserver.objects.bulk_create([DomainNameserver(domain=locked,hostname=ns,sort_order=i) for i,ns in enumerate(proof["nameservers"])])
        order=Order.objects.select_for_update().get(pk=grant["order"])
        from .live_cart import finish_domain_order
        finish_domain_order(order)
        AuditLog.objects.create(actor=None,action="live_domain_registration_confirmed",entity_type="Domain",
            entity_id=str(locked.pk),entity_name=locked.domain_name,details={"order":order.pk,"provider_order":proof["order_id"],"expires_at":expires.isoformat()})
    return "processed"
