"""Synthetic-capable, offline encrypted vault snapshot verifier; never restores to Production."""
import base64
import binascii
import hashlib
import hmac
import json
import sqlite3
import uuid
from datetime import datetime
from types import SimpleNamespace
from cryptography.fernet import Fernet,InvalidToken
from django.conf import settings
from django.db import transaction
from .connection_models import IntegrationConnection,IntegrationCredentialVersion,IntegrationConnectionEvent
from .connection_vault import VaultUnavailable,unseal_version
from .connection_audit import audit_key,signature,verify_chain

MAX_RECORDS=1000
MAX_BYTES=4_000_000

def backup_cipher():
    key=getattr(settings,"CLOUD_PROVIDER_RECOVERY_KEY","")
    if not key or key in (getattr(settings,"CLOUD_PROVIDER_VAULT_KEY",""),
            getattr(settings,"CLOUD_PROVIDER_STEPUP_KEY",""),
            getattr(settings,"CLOUD_PROVIDER_AUDIT_KEY",""),
            getattr(settings,"ENCRYPTION_KEY","")):
        raise VaultUnavailable()
    try:
        if len(base64.b64decode(key,altchars=b"-_",validate=True))!=32: raise ValueError("Key")
        return Fernet(key.encode("ascii"))
    except (ValueError,TypeError,UnicodeError,binascii.Error) as exc:
        raise VaultUnavailable() from exc

@transaction.atomic
def build_isolated_snapshot():
    """Review-only encrypted in-memory snapshot; no file, network or API export."""
    if not getattr(settings,"CLOUD_PROVIDER_SNAPSHOT_REVIEW_ENABLED",False): raise VaultUnavailable()
    crypt=backup_cipher()
    connections=list(IntegrationConnection.objects.select_for_update().order_by("pk")[:251])
    if len(connections)>250: raise VaultUnavailable()
    out=[]
    total=0
    for conn in connections:
        verify_chain(conn)
        versions=list(IntegrationCredentialVersion.objects.select_for_update().filter(connection=conn).order_by("version")[:MAX_RECORDS+1])
        events=list(IntegrationConnectionEvent.objects.filter(connection=conn).order_by("sequence")[:MAX_RECORDS+1])
        total+=len(versions)+len(events)
        if total>MAX_RECORDS: raise VaultUnavailable()
        for version in versions: unseal_version(version)
        out.append({"id":str(conn.pk),"adapter":conn.adapter_key,
            "state":conn.state,"current":conn.current_version,
            "head":conn.audit_head,"sequence":conn.audit_sequence,
            "versions":[{"number":v.version,"key":v.key_id,"cipher":v.ciphertext,
                         "revoked":bool(v.revoked_at)} for v in versions],
            "events":[{"number":e.sequence,"actor":e.actor_id,"action":e.action,
                       "version":e.version,"date":e.created_at.isoformat(),
                       "prev":e.previous_mac,"mac":e.event_mac} for e in events]})
    data=json.dumps({"format":"octalve-vault-recovery-v1","connections":out},
                    sort_keys=True,separators=(",",":")).encode()
    if len(data)>MAX_BYTES//2: raise VaultUnavailable()
    return crypt.encrypt(data)

def verify_isolated_snapshot(blob):
    """Independent SQLite in-memory restoration/verification; no source DB writes."""
    if not isinstance(blob,bytes) or not 80<len(blob)<=MAX_BYTES: raise VaultUnavailable()
    try:
        raw=backup_cipher().decrypt(blob)
        if len(raw)>MAX_BYTES//2: raise VaultUnavailable()
        data=json.loads(raw)
    except (InvalidToken,ValueError,UnicodeError,TypeError) as exc: raise VaultUnavailable() from exc
    if not isinstance(data,dict) or set(data)!={"format","connections"} or data["format"]!="octalve-vault-recovery-v1" or not isinstance(data["connections"],list) or len(data["connections"])>250:
        raise VaultUnavailable()
    try:
        with sqlite3.connect(":memory:") as scratch:
            scratch.execute("CREATE TABLE connections(id TEXT PRIMARY KEY,adapter TEXT,head TEXT,seq INTEGER)")
            scratch.execute("CREATE TABLE versions(connection_id TEXT,num INTEGER,PRIMARY KEY(connection_id,num))")
            scratch.execute("CREATE TABLE events(connection_id TEXT,num INTEGER,PRIMARY KEY(connection_id,num))")
            counts={"connections":0,"versions":0,"events":0}
            audit_secret=audit_key()
            for row in data["connections"]:
                if not isinstance(row,dict) or set(row)!={"id","adapter","state","current","head","sequence","versions","events"}:
                    raise VaultUnavailable()
                uuid.UUID(row["id"])
                if row["state"] not in ("draft","revoked") or not isinstance(row["adapter"],str):
                    raise VaultUnavailable()
                scratch.execute("INSERT INTO connections VALUES(?,?,?,?)",(row["id"],row["adapter"],row["head"],row["sequence"]))
                counts["connections"]+=1
                active=[]
                if not isinstance(row["versions"],list) or not isinstance(row["events"],list): raise VaultUnavailable()
                for version in row["versions"]:
                    if set(version)!={"number","key","cipher","revoked"}: raise VaultUnavailable()
                    scratch.execute("INSERT INTO versions VALUES(?,?)",(row["id"],version["number"]))
                    stub=SimpleNamespace(connection=SimpleNamespace(adapter_key=row["adapter"]),
                        connection_id=uuid.UUID(row["id"]),version=version["number"],
                        ciphertext=version["cipher"],key_id=version["key"])
                    unseal_version(stub)
                    if not version["revoked"]: active.append(version["number"])
                    counts["versions"]+=1
                if row["state"]=="draft" and active!=[row["current"]]: raise VaultUnavailable()
                if row["state"]=="revoked" and active: raise VaultUnavailable()
                prev=""
                if len(row["events"])!=row["sequence"]: raise VaultUnavailable()
                for index,event in enumerate(row["events"],start=1):
                    if set(event)!={"number","actor","action","version","date","prev","mac"}: raise VaultUnavailable()
                    scratch.execute("INSERT INTO events VALUES(?,?)",(row["id"],event["number"]))
                    if event["number"]!=index or event["prev"]!=prev: raise VaultUnavailable()
                    from .connection_audit import ALLOWED_ACTIONS
                    if event["action"] not in ALLOWED_ACTIONS: raise VaultUnavailable()
                    expected=signature(audit_secret,row["id"],index,event["action"],event["version"],
                          event["actor"],prev,datetime.fromisoformat(event["date"]))
                    if not hmac.compare_digest(expected,event["mac"]): raise VaultUnavailable()
                    prev=event["mac"]
                    counts["events"]+=1
                if row["head"]!=prev: raise VaultUnavailable()
                if counts["versions"]+counts["events"]>MAX_RECORDS: raise VaultUnavailable()
            counts["isolated"]=True
            counts["encrypted_sha256"]=hashlib.sha256(blob).hexdigest()
            return counts
    except (sqlite3.Error,ValueError,TypeError,KeyError,UnicodeError,AttributeError) as exc:
        raise VaultUnavailable() from exc
