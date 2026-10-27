"""Versioned AEAD vault with strict key IDs, offline rewrap and no HTTP secret read."""
import base64
import binascii
import json
import re
from cryptography.fernet import Fernet,InvalidToken
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import APIException

class VaultUnavailable(APIException):
    status_code=503
    default_detail="Credential storage is unavailable."
    default_code="vault_unavailable"

def valid_key(key):
    try:
        if not isinstance(key,str) or len(base64.urlsafe_b64decode(key))!=32:
            raise ValueError("Invalid key length")
        return Fernet(key.encode("ascii"))
    except (ValueError,TypeError,UnicodeError,binascii.Error) as exc:
        raise VaultUnavailable() from exc

def keyring():
    """Key material supplied outside source/Neon; bound to persisted key_id."""
    active_id=getattr(settings,"CLOUD_PROVIDER_VAULT_KEY_ID","")
    active_key=getattr(settings,"CLOUD_PROVIDER_VAULT_KEY","")
    if not isinstance(active_id,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,32}",active_id):
        raise VaultUnavailable()
    forbidden=(getattr(settings,"ENCRYPTION_KEY",""),
               getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY",""))
    if not active_key or active_key in forbidden:
        raise VaultUnavailable()
    primary=valid_key(active_key)
    raw=getattr(settings,"CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON","")
    try: prior=json.loads(raw) if raw else {}
    except (ValueError,TypeError) as exc: raise VaultUnavailable() from exc
    if not isinstance(prior,dict) or len(prior)>8 or active_id in prior:
        raise VaultUnavailable()
    result={active_id:primary}
    seen={active_key}
    for ident,key in prior.items():
        if not isinstance(ident,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,32}",ident):
            raise VaultUnavailable()
        if not isinstance(key,str) or key in seen or key in forbidden:
            raise VaultUnavailable()
        result[ident]=valid_key(key)
        seen.add(key)
    return active_id,result

def vault():
    identifier,keys=keyring()
    return keys[identifier]

def encode_bound(adapter,connection_id,version,secrets):
    if not isinstance(secrets,dict):
        raise VaultUnavailable()
    return json.dumps({"adapter":adapter,"connection_id":str(connection_id),
                       "version":version,"secrets":secrets},separators=(",",":"),sort_keys=True).encode()

def seal(adapter,connection_id,version,secrets):
    return vault().encrypt(encode_bound(adapter,connection_id,version,secrets)).decode()

def unseal_version(record):
    """Internal recovery only; never call from a customer/admin API view."""
    _,keys=keyring()
    fern=keys.get(record.key_id)
    if fern is None: raise VaultUnavailable()
    try:
        payload=json.loads(fern.decrypt(record.ciphertext.encode("ascii")).decode("utf-8"))
        if (payload.get("adapter")!=record.connection.adapter_key or
            payload.get("connection_id")!=str(record.connection_id) or
            payload.get("version")!=record.version or not isinstance(payload.get("secrets"),dict)):
            raise VaultUnavailable()
        return payload["secrets"]
    except (InvalidToken,ValueError,TypeError,UnicodeError,KeyError) as exc:
        raise VaultUnavailable() from exc

def inspect_test_only(ciphertext,adapter,connection_id,version):
    """Legacy unit-test helper. Normal keyring readback uses unseal_version."""
    try: data=json.loads(vault().decrypt(ciphertext.encode()).decode())
    except (InvalidToken,ValueError,UnicodeError) as exc: raise VaultUnavailable() from exc
    if data["adapter"]!=adapter or data["connection_id"]!=str(connection_id) or data["version"]!=version:
        raise VaultUnavailable()
    return data["secrets"]

@transaction.atomic
def rewrap_versions(*,apply=False):
    """Bounded all-or-nothing offline key rollover. No API routes, no provider calls."""
    from .connection_models import IntegrationCredentialVersion
    active_id,_=keyring()
    queryset=IntegrationCredentialVersion.objects.select_for_update().select_related("connection").order_by("pk")
    rows=list(queryset[:1001])
    if len(rows)>1000: raise VaultUnavailable()
    # Check every record, including revoked history, BEFORE updating even the first one.
    prepared=[]
    for row in rows:
        secrets=unseal_version(row)
        if row.key_id!=active_id:
            prepared.append((row,seal(row.connection.adapter_key,row.connection_id,row.version,secrets)))
    if apply:
        if not getattr(settings,"CLOUD_PROVIDER_VAULT_REWRAP_ENABLED",False):
            raise VaultUnavailable()
        for row,ciphertext in prepared:
            row.ciphertext=ciphertext
            row.key_id=active_id
            row.save(update_fields=["ciphertext","key_id"])
    return {"examined":len(rows),"rewrapped":len(prepared),"applied":bool(apply)}
