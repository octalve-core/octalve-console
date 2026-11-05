"""Isolated RFC6238 authenticator for high-risk provider credential actions."""
import base64
import binascii
import hashlib
import hmac
import json
import re
import secrets
import struct
import time
from datetime import timedelta
from urllib.parse import quote
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from .connection_vault import VaultUnavailable
from .connection_models import ProviderVaultAuthenticator

_KEY_ID = re.compile(r"[A-Za-z0-9_-]{1,32}")


def stepup_keyring():
    """Versioned MFA encryption keys, with bounded recovery-only old versions.

    Historic unversioned ciphertext is interpreted as version v1. Never remove
    v1 until every authenticator has been rewrapped and independently tested.
    """
    active_id=getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY_ID","v1")
    active_key=getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY","")
    forbidden={
        getattr(settings,"CLOUD_PROVIDER_VAULT_KEY",""),
        getattr(settings,"CLOUD_PROVIDER_AUDIT_KEY",""),
        getattr(settings,"CLOUD_PROVIDER_RECOVERY_KEY",""),
        getattr(settings,"CLOUD_PROVIDER_CHECKPOINT_KEY",""),
        getattr(settings,"ENCRYPTION_KEY",""),
    }
    if (not isinstance(active_id,str) or not _KEY_ID.fullmatch(active_id)
            or not isinstance(active_key,str) or not active_key or active_key in forbidden):
        raise VaultUnavailable()
    raw=getattr(settings,"CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON","")
    try:
        previous=json.loads(raw) if raw else {}
    except (ValueError,TypeError) as exc:
        raise VaultUnavailable() from exc
    if not isinstance(previous,dict) or len(previous)>8 or active_id in previous:
        raise VaultUnavailable()
    all_values=[active_key]
    for ident,value in previous.items():
        if (not isinstance(ident,str) or not _KEY_ID.fullmatch(ident)
                or not isinstance(value,str) or not value or value in forbidden
                or value in all_values):
            raise VaultUnavailable()
        all_values.append(value)
    try:
        keys={}
        for ident,value in [(active_id,active_key),*previous.items()]:
            if len(base64.b64decode(value,altchars=b"-_",validate=True))!=32:
                raise ValueError("Invalid key length")
            keys[ident]=Fernet(value.encode("ascii"))
    except (ValueError,TypeError,UnicodeError,binascii.Error) as exc:
        raise VaultUnavailable() from exc
    return active_id,keys


def cipher():
    active,keys=stepup_keyring()
    return keys[active]


def encrypt_stepup_secret(secret):
    ident,keys=stepup_keyring()
    return ident+"."+keys[ident].encrypt(secret.encode("ascii")).decode("ascii")


def stepup_ciphertext_id(ciphertext):
    if not isinstance(ciphertext,str) or not ciphertext:
        raise VaultUnavailable()
    if "." not in ciphertext:
        return "v1",ciphertext  # explicit legacy-read compatibility
    ident,token=ciphertext.split(".",1)
    if not _KEY_ID.fullmatch(ident) or not token:
        raise VaultUnavailable()
    return ident,token

def otp_at(secret,counter):
    digest=hmac.new(base64.b32decode(secret,casefold=True),struct.pack(">Q",counter),hashlib.sha1).digest()
    offset=digest[-1]&15
    return f"{(struct.unpack('>I',digest[offset:offset+4])[0]&0x7fffffff)%1000000:06d}"

def current_step(): return int(time.time()//30)

def verify_code(secret,code,after=-1):
    if not isinstance(code,str) or len(code)!=6 or not code.isascii() or not code.isdecimal(): return None
    now=current_step()
    for step in (now-1,now,now+1):
        if step>after and step>=0 and hmac.compare_digest(otp_at(secret,step),code): return step
    return None

def protected_secret(record):
    ident,token=stepup_ciphertext_id(record.encrypted_secret)
    _,keys=stepup_keyring()
    crypt=keys.get(ident)
    if crypt is None: raise VaultUnavailable()
    try:
        return crypt.decrypt(token.encode("ascii")).decode("ascii")
    except (InvalidToken,ValueError,UnicodeError) as exc:
        raise VaultUnavailable() from exc


@transaction.atomic
def rewrap_stepup_authenticators(*,apply=False):
    """Offline rewrap with all-record prevalidation; no HTTP endpoint or secret output."""
    active,_=stepup_keyring()
    records=list(ProviderVaultAuthenticator.objects.select_for_update().order_by("pk")[:501])
    if len(records)>500:
        raise VaultUnavailable()
    prepared=[]
    for record in records:
        secret=protected_secret(record)
        ident,_=stepup_ciphertext_id(record.encrypted_secret)
        if ident!=active:
            prepared.append((record,encrypt_stepup_secret(secret)))
    if apply:
        if not getattr(settings,"CLOUD_PROVIDER_STEPUP_REWRAP_ENABLED",False):
            raise VaultUnavailable()
        for record,encrypted in prepared:
            record.encrypted_secret=encrypted
            record.save(update_fields=["encrypted_secret"])
    return {"examined":len(records),"rewrapped":len(prepared),"applied":bool(apply)}

def assert_admin(user):
    if (user is None or not getattr(user, "is_authenticated", False) or
            not user.is_active or not user.is_staff or
            not user.is_superuser or user.role!="admin" or
            getattr(user, "email_verified_at", None) is None):
        raise PermissionDenied("Only an active Super Admin may configure provider security.")

def assert_password(user,password):
    if not isinstance(password,str) or len(password)>512 or not user.check_password(password):
        raise PermissionDenied("Current account password was not accepted.")

@transaction.atomic
def start(user,password):
    assert_admin(user)
    if not (getattr(settings,"CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED",False) and
            getattr(settings,"CLOUD_PROVIDER_CUSTODY_VERIFIED",False)):
        raise VaultUnavailable()
    assert_password(user,password)
    cipher()  # Keyring must be fully qualified before any authenticator mutation.
    user.__class__.objects.select_for_update().get(pk=user.pk)
    row,_=ProviderVaultAuthenticator.objects.select_for_update().get_or_create(
        user=user,defaults={"encrypted_secret":"","verified":False,"last_counter":-1})
    if row.verified: raise PermissionDenied("Already enrolled. Use an independently approved account recovery process.")
    secret=base64.b32encode(secrets.token_bytes(20)).decode("ascii")
    row.encrypted_secret=encrypt_stepup_secret(secret)
    row.pending_until=timezone.now()+timedelta(minutes=5)
    row.last_counter=-1
    row.save(update_fields=["encrypted_secret","pending_until","last_counter"])
    url=("otpauth://totp/"+quote("Octalve Provider Vault:"+user.email,safe="")+
         "?secret="+secret+"&issuer="+quote("Octalve Provider Vault")+"&algorithm=SHA1&digits=6&period=30")
    return {"secret":secret,"otpauth_url":url,"expires_in_seconds":300}

@transaction.atomic
def confirm(user,password,code):
    assert_admin(user)
    if not (getattr(settings,"CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED",False) and
            getattr(settings,"CLOUD_PROVIDER_CUSTODY_VERIFIED",False)):
        raise VaultUnavailable()
    assert_password(user,password)
    try: row=ProviderVaultAuthenticator.objects.select_for_update().get(user=user)
    except ProviderVaultAuthenticator.DoesNotExist: raise PermissionDenied("Enrollment not started.")
    if row.verified or not row.pending_until or row.pending_until<timezone.now():
        raise PermissionDenied("Enrollment is no longer pending.")
    step=verify_code(protected_secret(row),code)
    if step is None: raise PermissionDenied("Authenticator code was not accepted.")
    row.verified=True
    row.last_counter=step
    row.pending_until=None
    row.save(update_fields=["verified","last_counter","pending_until"])
    return {"verified":True,"kind":"totp","provider_execution_enabled":False}

@transaction.atomic
def check_mutation(user,password,code):
    assert_admin(user)
    assert_password(user,password)
    try: row=ProviderVaultAuthenticator.objects.select_for_update().get(user=user,verified=True)
    except ProviderVaultAuthenticator.DoesNotExist: raise PermissionDenied("Enroll a provider-vault authenticator first.")
    step=verify_code(protected_secret(row),code,row.last_counter)
    if step is None: raise PermissionDenied("Authenticator code is invalid or has already been used.")
    row.last_counter=step
    row.save(update_fields=["last_counter"])
