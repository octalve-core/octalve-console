"""Independent hosting-domain control proof, not external DNS zone management."""
import hashlib
import hmac
import json
import secrets
from datetime import timedelta
import requests
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from providers.connection_audit import audit_keyring
from providers.connection_vault import VaultUnavailable
from provisioning.models import ProvisioningTask
from provisioning.fulfillment import DOMAIN

KEY="hosting_domain_challenge_v1"


def _payload(task):
    data=task.metadata.get(KEY)
    try:
        payload=data["payload"]
        _,keys=audit_keyring()
        digest=hmac.new(keys[data["key_id"]],json.dumps(payload,sort_keys=True,
            separators=(",",":")).encode(),hashlib.sha256).hexdigest()
        until=parse_datetime(payload["expires_at"])
        if (not hmac.compare_digest(data["mac"],digest) or payload["task"]!=task.pk
                or payload["client"]!=task.service.client_id
                or payload["domain"]!=task.service.domain_name
                or not DOMAIN.fullmatch(payload["domain"]) or len(payload["domain"])>234
                or not isinstance(payload["token"],str) or len(payload["token"])!=43
                or until is None or timezone.is_naive(until) or until<=timezone.now()):
            return None
        return payload
    except (KeyError,TypeError,ValueError,AttributeError,VaultUnavailable):
        return None


@transaction.atomic
def issue_challenge(task_id,owner_id):
    task=ProvisioningTask.objects.select_for_update().get(pk=task_id,
        service__client_id=owner_id,action="provision",metadata__authority="verified_paid_order")
    if (task.status not in ("queued","pending_confirmation") or task.service.status!="pending"
            or not DOMAIN.fullmatch(task.service.domain_name or "") or len(task.service.domain_name)>234):
        return None
    prior=_payload(task)
    if prior:
        return prior
    # No challenge changes after a possible external account creation.
    if task.metadata.get("remote_create",{}).get("state")=="dispatched_uncertain":
        return None
    payload={"task":task.pk,"client":owner_id,"domain":task.service.domain_name,
        "token":secrets.token_urlsafe(32),"expires_at":(timezone.now()+timedelta(days=7)).isoformat()}
    active,keys=audit_keyring()
    digest=hmac.new(keys[active],json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),
                    hashlib.sha256).hexdigest()
    task.metadata={**task.metadata,KEY:{"payload":payload,"key_id":active,"mac":digest}}
    task.save(update_fields=["metadata","updated_at"])
    from services.commercial_scheduler import wake
    wake("provisioning")
    return payload


def verified_domain(task):
    """DNS name and exact TXT value must match; no HTTP challenge/SSRF."""
    payload=_payload(task)
    if not payload:
        return False
    name="_octalve-hosting."+payload["domain"]
    session=requests.Session()
    session.trust_env=False
    try:
        with session.get("https://dns.google/resolve",params={"name":name,"type":"TXT"},
            headers={"Accept":"application/dns-json"},timeout=(3,5),allow_redirects=False,
            verify=True,stream=True) as response:
            if response.status_code!=200:
                return False
            buf=bytearray()
            for chunk in response.iter_content(chunk_size=4096):
                buf.extend(chunk)
                if len(buf)>32768:
                    return False
            body=json.loads(bytes(buf))
        if not isinstance(body,dict) or type(body.get("Status")) is not int or body.get("Status")!=0 or body.get("TC") is True:
            return False
        answers=body.get("Answer")
        if not isinstance(answers,list) or len(answers)>100:
            return False
        expected="octalve-hosting="+payload["token"]
        return any(isinstance(a,dict) and a.get("type")==16 and
            isinstance(a.get("name"),str) and a["name"].rstrip(".").lower()==name and
            a.get("data") in (expected,'"'+expected+'"') for a in answers)
    except (requests.RequestException,ValueError,TypeError):
        return False
    finally:
        session.close()


def public_challenge(payload):
    return {"type":"TXT","name":"_octalve-hosting."+payload["domain"],
            "value":"octalve-hosting="+payload["token"],"expires_at":payload["expires_at"]}
