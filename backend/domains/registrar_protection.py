"""Owner-authorized registrar lock and EPP operations with independent readback.

OTP is supplied directly to the documented registrar endpoint. Never store it.
A reserved write is not retried blindly; reconcile actual provider state first.
"""
import secrets
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.debug import sensitive_variables
from audit.models import AuditLog
from providers.connection_models import IntegrationConnection
from providers.registrar_live_policy import load
from providers.resellerclub_live import secret_code
from .models import Domain
from .live_registration import KEY,digest,RegistrationRefused
from .resellerclub_lifecycle import read,PROTECTION,OTP,NS

@sensitive_variables("secret","data","code","otp","proof")
def perform(user,domain,entry,grant,row,secret,adapter,data):
    op=data["operation"]
    proof=read(domain,entry,adapter)
    if proof["status"]!="Active":
        raise RegistrationRefused()
    if op=="lock-status":
        return {"locks":adapter.locks(domain.provider_domain_id)}
    if op=="request-otp":
        action=data["action"]
        if action not in ("modify-ns","modify-auth-code","modify-theft-protection"):raise RegistrationRefused()
        with transaction.atomic():
            locked=Domain.objects.select_for_update().get(pk=domain.pk)
            IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            if locked.metadata!=domain.metadata or load(grant["route"])[1]!=secret:raise RegistrationRefused()
            previous=parse_datetime(locked.metadata.get(OTP,{}).get("at",""))
            if previous and previous>timezone.now()-timedelta(minutes=1):raise RegistrationRefused()
            locked.metadata={**locked.metadata,OTP:{"action":action,"at":timezone.now().isoformat()}}
            locked.save(update_fields=["metadata","updated_at"])
        if not adapter.email_otp(domain.provider_domain_id,action):raise RegistrationRefused()
        return {"state":"otp_requested"}
    if op not in ("transfer-lock","change-auth-code"):raise RegistrationRefused()
    otp=data.get("otp")
    adapter.otp_fields(otp)
    target={"operation":op,"state":"uncertain","reserved_at":timezone.now().isoformat()}
    if op=="transfer-lock":
        desired=data["enabled"]
        if type(desired) is not bool:raise RegistrationRefused()
        if adapter.locks(domain.provider_domain_id)["transferLock"] is desired:return {"state":"confirmed"}
        target["enabled"]=desired
    else:
        code=secret_code(data["code"])
        import re
        if not re.search(r"[A-Za-z]",code) or not re.search(r"[0-9]",code) or not re.search(r"[^A-Za-z0-9]",code):raise RegistrationRefused()
        # HMAC via Django signing key, not a reversible plain-text EPP secret.
        from django.utils.crypto import salted_hmac
        nonce=secrets.token_hex(24)
        target.update(nonce=nonce,digest=salted_hmac("octalve.epp.confirm."+nonce,code,algorithm="sha256").hexdigest())
    with transaction.atomic():
        locked=Domain.objects.select_for_update().get(pk=domain.pk)
        IntegrationConnection.objects.select_for_update().get(pk=row.pk)
        if (locked.metadata!=domain.metadata or locked.metadata.get(PROTECTION,{}).get("state")=="uncertain"
            or locked.metadata.get(NS,{}).get("state")=="uncertain" or load(grant["route"])[1]!=secret):
            raise RegistrationRefused()
        locked.metadata={**locked.metadata,PROTECTION:target,KEY:{**entry,"reconcile_after":timezone.now().isoformat()}}
        locked.save(update_fields=["metadata","updated_at"])
        AuditLog.objects.create(actor=user,action="domain_protection_reserved",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={"operation":op})
    if load(grant["route"])[1]==secret:
        if op=="transfer-lock": adapter.change_transfer_lock(domain.provider_domain_id,desired,otp)
        else: adapter.change_auth_code(domain.provider_domain_id,code,otp)
    return {"state":"uncertain"}
