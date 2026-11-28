"""Owner-bound registrar management. Supplier evidence, not local guesses."""
from datetime import timedelta
from django.core import signing
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.debug import sensitive_variables
from rest_framework.exceptions import ValidationError,NotFound,Throttled
from rest_framework.response import Response
from audit.models import AuditLog
from providers.connection_vault import VaultUnavailable
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.resellerclub_live import nameservers,ResellerClubUnavailable
from providers.registrar_live_policy import load
from .models import Domain,DomainNameserver
from .live_registration import KEY,SALT,HEADERS,connector,digest,enabled,account_id,RegistrationRefused

NS="registrar_nameserver_change_v1"

def managed(domain):
    entry=domain.metadata[KEY]
    grant=signing.loads(entry["grant"],salt=SALT)
    if (not enabled() or domain.registrar!="resellerclub" or domain.management_kind!="registrar"
        or entry.get("state")!="confirmed" or domain.client_id!=grant["owner"]
        or domain.domain_name!=grant["domain"] or not domain.order_item_id
        or domain.order_item_id!=grant["item"] or domain.order_item.order_id!=grant["order"]
        or digest(domain.registrant_contact)!=grant["contact_digest"] or not domain.provider_domain_id):
        raise RegistrationRefused("Registrar ownership unavailable.")
    row,secret,adapter=connector(grant["route"])
    if row.adapter_key!="resellerclub" or account_id(row)!=grant["account_id"]:
        raise RegistrationRefused("Registrar binding changed.")
    return entry,grant,row,secret,adapter

def read(domain,entry,adapter,*,include_secret=False):
    proof=adapter.domain_details(domain.domain_name,order=domain.provider_domain_id,
        customer=entry["rc_customer"],contact=entry["rc_contact"],include_secret=include_secret)
    if (not proof or parse_datetime(proof["registered_at"])!=domain.registration_date
        or proof.get("registrant_email")!=domain.registrant_contact["email"]
        or proof.get("auto_renew") is not False or proof.get("premium") is not False):
        raise RegistrationRefused("Supplier resource identity changed.")
    return proof

def local_status(proof):
    if proof["status"]=="Active":
        return "active" if parse_datetime(proof["expires_at"])>timezone.now() else "expired"
    if proof["status"]=="Pending Verification": return "pending"
    if proof["status"] in ("Deleted","Archived","Pending Delete Restorable"): return "expired"
    return "suspended"

def reconcile(domain):
    entry,grant,row,secret,adapter=managed(domain)
    proof=read(domain,entry,adapter)
    with transaction.atomic():
        locked=Domain.objects.select_for_update().get(pk=domain.pk)
        IntegrationConnection.objects.select_for_update().get(pk=row.pk)
        if locked.metadata!=domain.metadata or locked.provider_domain_id!=domain.provider_domain_id or load(grant["route"])[1]!=secret:
            return "held"
        if not locked.metadata.get("registrar_renewal_v1",{}).get("state") in ("queued","uncertain"):
            locked.expiry_date=parse_datetime(proof["expires_at"])
            locked.next_due_date=locked.expiry_date
        locked.status=local_status(proof);locked.is_active=locked.status=="active"
        locked.metadata={**locked.metadata,KEY:{**entry,"supplier_status":proof["status"],
            "registrant_verification":proof["registrant_verification"],"last_reconciled_at":timezone.now().isoformat(),
            "reconcile_after":(timezone.now()+timedelta(hours=12)).isoformat()}}
        pending=locked.metadata.get(NS,{})
        if proof["nameservers"]:
            DomainNameserver.objects.filter(domain=locked).delete()
            DomainNameserver.objects.bulk_create([DomainNameserver(domain=locked,hostname=n,sort_order=i) for i,n in enumerate(proof["nameservers"])])
            if pending.get("state")=="uncertain" and set(pending["nameservers"])==set(proof["nameservers"]):
                locked.metadata[NS]={**pending,"state":"confirmed","confirmed_at":timezone.now().isoformat()}
        locked.save(update_fields=["metadata","status","is_active","expiry_date","next_due_date","updated_at"])
    return "processed"

def owner(user,domain):
    if user.role!="client" or not user.is_active or not user.email_verified_at or domain.client_id!=user.pk:
        raise NotFound()

@sensitive_variables("password","proof")
def handle(request,domain):
    owner(request.user,domain)
    try:
        entry,grant,row,secret,adapter=managed(domain)
        if request.method=="GET":
            return Response({"domain":domain.domain_name,"available":True,"auto_renew":domain.auto_renew,
                "registrant_verification":entry.get("registrant_verification","unknown"),
                "nameservers":list(domain.nameservers.order_by("sort_order").values_list("hostname",flat=True)),
                "nameserver_state":domain.metadata.get(NS,{}).get("state","idle"),
                "last_reconciled_at":entry.get("last_reconciled_at",entry.get("confirmed_at"))},headers=HEADERS)
        data=request.data
        if not isinstance(data,dict): raise RegistrationRefused()
        op=data.get("operation")
        fields={"operation","password"}|({"nameservers"} if op=="nameservers" else {"enabled"} if op=="auto-renew" else set())
        password=data.get("password")
        if set(data)!=fields or not isinstance(password,str) or not request.user.check_password(password):
            raise RegistrationRefused()
        if op=="renew":
            from .resellerclub_renewals import create_invoice
            return Response(create_invoice(domain),headers=HEADERS)
        if op=="auto-renew":
            if type(data["enabled"]) is not bool: raise RegistrationRefused()
            with transaction.atomic():
                locked=Domain.objects.select_for_update().get(pk=domain.pk)
                if locked.metadata!=domain.metadata: raise RegistrationRefused()
                locked.auto_renew=data["enabled"];locked.save(update_fields=["auto_renew","updated_at"])
                AuditLog.objects.create(actor=request.user,action="domain_renewal_preference",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={"enabled":locked.auto_renew})
            return Response({"auto_renew":locked.auto_renew},headers=HEADERS)
        if op not in ("auth-code","nameservers","resend-verification"): raise RegistrationRefused()
        proof=read(domain,entry,adapter,include_secret=op=="auth-code")
        if op=="auth-code":
            if proof["status"]!="Active": raise RegistrationRefused()
            AuditLog.objects.create(actor=request.user,action="domain_auth_code_access",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={})
            return Response({"auth_code":proof["auth_code"]},headers=HEADERS)
        if op=="resend-verification":
            if proof["status"]!="Pending Verification" and proof["registrant_verification"].lower() not in ("pending","unverified","failed"):
                raise RegistrationRefused()
            if not adapter.resend_verification(domain.provider_domain_id): raise RegistrationRefused()
            return Response({"state":"requested"},headers=HEADERS)
        desired=nameservers(data["nameservers"])
        if proof["status"]!="Active": raise RegistrationRefused()
        if set(desired)==set(proof["nameservers"]): return Response({"state":"confirmed"},headers=HEADERS)
        with transaction.atomic():
            locked=Domain.objects.select_for_update().get(pk=domain.pk)
            IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            if locked.metadata!=domain.metadata or locked.metadata.get(NS,{}).get("state")=="uncertain" or load(grant["route"])[1]!=secret:
                raise RegistrationRefused()
            locked.metadata={**locked.metadata,NS:{"state":"uncertain","nameservers":desired,"reserved_at":timezone.now().isoformat()},
                KEY:{**entry,"reconcile_after":timezone.now().isoformat()}}
            locked.save(update_fields=["metadata","updated_at"])
            AuditLog.objects.create(actor=request.user,action="domain_nameservers_reserved",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={"nameservers":desired})
        if load(grant["route"])[1]==secret:
            adapter.change_nameservers(domain.provider_domain_id,desired)
        return Response({"state":"uncertain"},status=202,headers=HEADERS)
    except (RegistrationRefused,ResellerClubUnavailable,VaultUnavailable,DatabaseError,KeyError,ValueError,TypeError,signing.BadSignature,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist):
        raise ValidationError("Registrar operation unavailable or requires independent reconciliation. Do not repeat uncertain changes.") from None
