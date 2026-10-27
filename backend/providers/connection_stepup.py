"""Isolated RFC6238 authenticator for high-risk provider credential actions."""
import base64
import binascii
import hashlib
import hmac
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

def cipher():
    key=getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY","")
    if not key or key in (getattr(settings,"CLOUD_PROVIDER_VAULT_KEY",""),getattr(settings,"ENCRYPTION_KEY","")):
        raise VaultUnavailable()
    try:
        if len(base64.urlsafe_b64decode(key))!=32: raise ValueError("Invalid key size")
        return Fernet(key.encode("ascii"))
    except (ValueError,TypeError,UnicodeError,binascii.Error) as exc:
        raise VaultUnavailable() from exc

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
    try: return cipher().decrypt(record.encrypted_secret.encode("ascii")).decode("ascii")
    except (InvalidToken,ValueError,UnicodeError) as exc: raise VaultUnavailable() from exc

def assert_admin(user):
    if not user.is_authenticated or not user.is_active or not user.is_superuser or user.role!="admin":
        raise PermissionDenied("Only an active Super Admin may configure provider security.")

def assert_password(user,password):
    if not isinstance(password,str) or len(password)>512 or not user.check_password(password):
        raise PermissionDenied("Current account password was not accepted.")

@transaction.atomic
def start(user,password):
    assert_admin(user)
    if not getattr(settings,"CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED",False): raise VaultUnavailable()
    assert_password(user,password)
    encryption=cipher()
    user.__class__.objects.select_for_update().get(pk=user.pk)
    row,_=ProviderVaultAuthenticator.objects.select_for_update().get_or_create(
        user=user,defaults={"encrypted_secret":"","verified":False,"last_counter":-1})
    if row.verified: raise PermissionDenied("Already enrolled. Use an independently approved account recovery process.")
    secret=base64.b32encode(secrets.token_bytes(20)).decode("ascii")
    row.encrypted_secret=encryption.encrypt(secret.encode()).decode()
    row.pending_until=timezone.now()+timedelta(minutes=5)
    row.last_counter=-1
    row.save(update_fields=["encrypted_secret","pending_until","last_counter"])
    url=("otpauth://totp/"+quote("Octalve Provider Vault:"+user.email,safe="")+
         "?secret="+secret+"&issuer="+quote("Octalve Provider Vault")+"&algorithm=SHA1&digits=6&period=30")
    return {"secret":secret,"otpauth_url":url,"expires_in_seconds":300}

@transaction.atomic
def confirm(user,password,code):
    assert_admin(user)
    if not getattr(settings,"CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED",False): raise VaultUnavailable()
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
