"""Separate keyed, sequenced provider lifecycle receipts. No credentials in payloads."""
import base64
import binascii
import hashlib
import hmac
import json
import re
from django.conf import settings
from django.utils import timezone
from .connection_models import IntegrationConnectionEvent
from .connection_vault import VaultUnavailable

ALLOWED_ACTIONS=frozenset(("draft_created","credential_rotated","credential_revoked"))
MAX_CHAIN=1000

_AUDIT_KEY_ID=re.compile(r"[A-Za-z0-9_-]{1,32}")


def audit_keyring():
    """Active HMAC key plus bounded historical verification keys.

    Audit receipts have no key_id field. Retain each previous HMAC key until
    historical receipts are retired through a separately qualified recovery
    procedure. The active key alone signs future append-only events.
    """
    active_id=getattr(settings,"CLOUD_PROVIDER_AUDIT_KEY_ID","v1")
    active_key=getattr(settings,"CLOUD_PROVIDER_AUDIT_KEY","")
    forbidden={
        getattr(settings,"CLOUD_PROVIDER_VAULT_KEY",""),
        getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY",""),
        getattr(settings,"CLOUD_PROVIDER_RECOVERY_KEY",""),
        getattr(settings,"CLOUD_PROVIDER_CHECKPOINT_KEY",""),
        getattr(settings,"ENCRYPTION_KEY",""),
    }
    if (not isinstance(active_id,str) or not _AUDIT_KEY_ID.fullmatch(active_id)
            or not isinstance(active_key,str) or not active_key or active_key in forbidden):
        raise VaultUnavailable()
    raw=getattr(settings,"CLOUD_PROVIDER_AUDIT_PREVIOUS_KEYS_JSON","")
    try: previous=json.loads(raw) if raw else {}
    except (ValueError,TypeError) as exc: raise VaultUnavailable() from exc
    if not isinstance(previous,dict) or len(previous)>8 or active_id in previous:
        raise VaultUnavailable()
    distinct={active_key}
    for ident,value in previous.items():
        if (not isinstance(ident,str) or not _AUDIT_KEY_ID.fullmatch(ident)
                or not isinstance(value,str) or not value or value in forbidden
                or value in distinct):
            raise VaultUnavailable()
        distinct.add(value)
    try:
        all_keys={}
        for ident,value in [(active_id,active_key),*previous.items()]:
            binary=base64.b64decode(value,altchars=b"-_",validate=True)
            if len(binary)!=32: raise ValueError("Invalid HMAC key")
            all_keys[ident]=binary
    except (ValueError,TypeError,binascii.Error) as exc:
        raise VaultUnavailable() from exc
    return active_id,all_keys


def audit_key():
    active,keys=audit_keyring()
    return keys[active]

def signature(secret,connection_id,sequence,action,version,actor_id,previous_mac,created_at):
    fields={"connection":str(connection_id),"sequence":sequence,"action":action,
            "version":version,"actor":str(actor_id) if actor_id else None,
            "previous_mac":previous_mac,"created_at":created_at.isoformat(timespec="microseconds")}
    canonical=json.dumps(fields,sort_keys=True,separators=(",",":")).encode()
    return hmac.new(secret,canonical,hashlib.sha256).hexdigest()

def verify_chain(connection):
    _,keys=audit_keyring()
    events=list(IntegrationConnectionEvent.objects.filter(connection=connection).order_by("sequence","pk")[:MAX_CHAIN+1])
    if len(events)>MAX_CHAIN: raise VaultUnavailable()
    previous=""
    for expected,row in enumerate(events,start=1):
        if (row.sequence!=expected or row.previous_mac!=previous or
            row.action not in ALLOWED_ACTIONS or len(row.event_mac)!=64):
            raise VaultUnavailable()
        # Historic events may have been signed by a previous independent audit
        # key. New events always use the active key. Never rewrite signed rows.
        if not any(hmac.compare_digest(
            signature(secret,connection.pk,row.sequence,row.action,row.version,
                      row.actor_id,row.previous_mac,row.created_at),
            row.event_mac
        ) for secret in keys.values()):
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
