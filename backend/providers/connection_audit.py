"""Separate keyed, sequenced provider lifecycle receipts. No credentials in payloads."""
import base64
import binascii
import hashlib
import hmac
import json
from django.conf import settings
from django.utils import timezone
from .connection_models import IntegrationConnectionEvent
from .connection_vault import VaultUnavailable

ALLOWED_ACTIONS=frozenset(("draft_created","credential_rotated","credential_revoked"))
MAX_CHAIN=1000

def audit_key():
    key=getattr(settings,"CLOUD_PROVIDER_AUDIT_KEY","")
    if not key or key in (getattr(settings,"CLOUD_PROVIDER_VAULT_KEY",""),
                          getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY",""),
                          getattr(settings,"ENCRYPTION_KEY","")):
        raise VaultUnavailable()
    try:
        binary=base64.b64decode(key,altchars=b"-_",validate=True)
        if len(binary)!=32: raise ValueError("Invalid HMAC key")
        return binary
    except (ValueError,TypeError,binascii.Error) as exc: raise VaultUnavailable() from exc

def signature(secret,connection_id,sequence,action,version,actor_id,previous_mac,created_at):
    fields={"connection":str(connection_id),"sequence":sequence,"action":action,
            "version":version,"actor":str(actor_id) if actor_id else None,
            "previous_mac":previous_mac,"created_at":created_at.isoformat(timespec="microseconds")}
    canonical=json.dumps(fields,sort_keys=True,separators=(",",":")).encode()
    return hmac.new(secret,canonical,hashlib.sha256).hexdigest()

def verify_chain(connection):
    secret=audit_key()
    events=list(IntegrationConnectionEvent.objects.filter(connection=connection).order_by("sequence","pk")[:MAX_CHAIN+1])
    if len(events)>MAX_CHAIN: raise VaultUnavailable()
    previous=""
    for expected,row in enumerate(events,start=1):
        if (row.sequence!=expected or row.previous_mac!=previous or
            row.action not in ALLOWED_ACTIONS or len(row.event_mac)!=64):
            raise VaultUnavailable()
        want=signature(secret,connection.pk,row.sequence,row.action,row.version,
                       row.actor_id,row.previous_mac,row.created_at)
        if not hmac.compare_digest(want,row.event_mac):
            raise VaultUnavailable()
        previous=row.event_mac
    if connection.audit_sequence!=len(events) or connection.audit_head!=previous:
        raise VaultUnavailable()
    return {"events":len(events),"integrity_verified":True}

def append_event(connection,actor,action,version):
    # Caller MUST own a row lock on connection inside the same transaction.
    if action not in ALLOWED_ACTIONS: raise VaultUnavailable()
    verify_chain(connection)
    when=timezone.now()
    sequence=connection.audit_sequence+1
    digest=signature(audit_key(),connection.pk,sequence,action,version,
                     actor.pk,connection.audit_head,when)
    IntegrationConnectionEvent.objects.create(
        connection=connection,actor=actor,action=action,version=version,
        sequence=sequence,previous_mac=connection.audit_head,event_mac=digest,
        created_at=when)
    connection.audit_sequence=sequence
    connection.audit_head=digest
    connection.save(update_fields=["audit_sequence","audit_head","updated_at"])
    return {"sequence":sequence,"integrity_receipt":digest}
