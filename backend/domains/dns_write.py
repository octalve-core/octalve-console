"""Separate, opt-in Cloudflare DNS record writes. Never upgrade read-only consent.

A credential is bound to a single zone, account, owner, read consent and
version. Every dispatch requires a durable reservation and fresh delegation
observation; acknowledgement alone is not success. No automatic write retries.
"""
import hashlib
import hmac
import ipaddress
import json
import re
import uuid
from datetime import timedelta

import requests
from django.conf import settings
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.debug import sensitive_variables
from rest_framework.exceptions import PermissionDenied,ValidationError,Throttled
from rest_framework.response import Response
from accounts.security_throttle import _spend
from audit.models import AuditLog
from providers.connection_audit import audit_keyring
from providers.connection_models import IntegrationConnection
from providers.connection_stepup import check_mutation
from providers.connection_vault import VaultUnavailable
from providers.cloudflare_int01 import API_ORIGIN,CloudflareINT01Denied,require_id,_require_result
from .models import Domain,DomainDNSBinding
from .dns_readonly import (_admin,_customer,_release_gate,_vault_read_ready,_binding_matches_domain,
    _continued_dns_only_proof,_conn,CONSENT_VERSION,NO_CACHE)
from .dns_authority import observe,hostname,DelegationUnavailable

POLICY="dns_write_policy_v1"
FENCE="dns_write_fence_v1"
KINDS={"A","AAAA","CNAME","MX","TXT","CAA","SRV"}
LABEL=re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")
UNDERSCORE=re.compile(r"_[a-z0-9-]{1,62}\Z")
PROTECTED={"_octalve","_acme-challenge","_domainkey","_dmarc","_mta-sts","_smtp._tls","autodiscover","autoconfig","mail","webmail","cpanel","whm","ns1","ns2","ftp"}

class Refused(ValueError):
    pass

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()).hexdigest()

def signed(payload):
    active,keys=audit_keyring()
    return {"payload":payload,"key":active,"mac":hmac.new(keys[active],digest(payload).encode(),hashlib.sha256).hexdigest()}

def verified(record):
    try:
        _,keys=audit_keyring()
        payload=record["payload"]
        if not isinstance(payload,dict) or not hmac.compare_digest(record["mac"],hmac.new(keys[record["key"]],digest(payload).encode(),hashlib.sha256).hexdigest()):
            raise Refused()
        return payload
    except (KeyError,TypeError,ValueError):
        raise Refused() from None

def gate():
    _release_gate()
    if not getattr(settings,"CLOUD_DNS_WRITE_ENABLED",False):
        raise Refused()
    _vault_read_ready()

def budget(request,domain):
    wait=_spend("dns:write",f"{request.user.pk}:{domain.pk}",5,300)
    if wait:
        raise Throttled(wait=wait)

def binding_for(domain):
    binding=DomainDNSBinding.objects.select_related("connection").filter(domain=domain).first()
    if (not binding or binding.state!=DomainDNSBinding.State.ACTIVE or not binding.consented_at
            or not binding.approved_at or binding.consent_version!=CONSENT_VERSION
            or not _binding_matches_domain(binding,domain)):
        raise Refused()
    if domain.management_kind=="registrar" and (not domain.expiry_date or domain.expiry_date<=timezone.now()):
        raise Refused()
    return binding

def identity(domain,binding):
    return {"domain":domain.pk,"name":domain.domain_name,"owner":domain.client_id,
            "binding":binding.pk,"read_connection":str(binding.connection_id),"read_version":binding.credential_version,
            "read_approved":binding.approved_at.isoformat(),"read_consented":binding.consented_at.isoformat(),
            "zone":binding.zone_id,"account":binding.connection.public_settings["account_id"]}

def policy(domain,binding):
    value=verified(domain.metadata.get(POLICY))
    if value.get("identity")!=identity(domain,binding):
        raise Refused()
    return value

def writer_for(binding,value):
    row=IntegrationConnection.objects.filter(pk=value["write_connection"],adapter_key="cloudflare-dns",environment="live",state="draft",current_version=value["write_version"]).first()
    if (not row or row.pk==binding.connection_id or
            row.public_settings.get("zone_id")!=binding.zone_id or
            row.public_settings.get("account_id")!=binding.connection.public_settings.get("account_id")):
        raise Refused()
    return row

def snapshot(domain,binding,connector):
    result=connector.dns_live_inventory(binding.zone_id,binding.zone_name)
    if not _continued_dns_only_proof(domain,result):
        raise Refused()
    public=observe(domain.domain_name)
    if public["state"]!="observed" or sorted(hostname(n) for n in result["nameservers"])!=public["nameservers"]:
        raise Refused()
    return result

def audit(request,domain,action,event=None):
    AuditLog.objects.create(actor=request.user,action=action,entity_type="Domain",entity_id=str(domain.pk),
                            entity_name="DNS record authority",details={"event":event,"zone_bound":True})

def shape(data,keys):
    if not isinstance(data,dict) or set(data)!=set(keys):
        raise ValidationError({"detail":"Invalid DNS operation fields."})

def confirm(request,password):
    if not isinstance(password,str) or not 1<=len(password)<=1024 or not request.user.check_password(password):
        raise PermissionDenied("Current account password not accepted.")

def lock_current(domain,binding):
    # Same lock order as read authorization approval.
    IntegrationConnection.objects.select_for_update().get(pk=binding.connection_id)
    current=Domain.objects.select_for_update().get(pk=domain.pk)
    locked=DomainDNSBinding.objects.select_for_update().select_related("connection").get(pk=binding.pk)
    if (current.client_id!=domain.client_id or current.domain_name!=domain.domain_name
            or locked.updated_at!=binding.updated_at or not _binding_matches_domain(locked,current)
            or locked.state!=DomainDNSBinding.State.ACTIVE):
        raise Refused()
    return current,locked

def access(request,domain):
    if request.user.role=="client":
        _customer(request,domain)
    else:
        _admin(request)
    state="unavailable"
    if getattr(settings,"CLOUD_DNS_WRITE_ENABLED",False):
        try:
            gate()
            binding=binding_for(domain)
            value=policy(domain,binding)
            state=value["state"]
            if state=="approved":
                writer_for(binding,value)
        except (Refused,VaultUnavailable,KeyError,ValueError,TypeError):
            state="not_authorized"
    return Response({"state":state,"domain":domain.domain_name,"pending":domain.metadata.get(FENCE,{}).get("state")=="uncertain"},headers=NO_CACHE)

@sensitive_variables("data")
def authorize(request,domain,action):
    gate()
    budget(request,domain)
    binding=binding_for(domain)
    data=request.data
    if action=="consent":
        _customer(request,domain)
        shape(data,("accept","confirm_password"))
        if data["accept"] is not True:
            raise Refused()
        confirm(request,data["confirm_password"])
        with transaction.atomic():
            current,locked=lock_current(domain,binding)
            if current.metadata.get(FENCE,{}).get("state")=="uncertain":
                raise Refused()
            value={"identity":identity(current,locked),"state":"consented","nonce":str(uuid.uuid4())}
            current.metadata={**current.metadata,POLICY:signed(value)}
            current.save(update_fields=["metadata"])
            audit(request,current,"domain_dns_write_consented")
    elif action=="approve":
        _admin(request)
        shape(data,("connection_id","confirm_password","totp_code"))
        value=policy(domain,binding)
        if value["state"]!="consented":
            raise Refused()
        row=IntegrationConnection.objects.filter(pk=uuid.UUID(data["connection_id"]),adapter_key="cloudflare-dns",state="draft",environment="live").first()
        if not row:
            raise Refused()
        value={**value,"state":"approved","write_connection":str(row.pk),"write_version":row.current_version}
        writer_for(binding,value)
        check_mutation(request.user,data["confirm_password"],data["totp_code"])
        connector=_conn(row,row.current_version)
        snapshot(domain,binding,connector)
        with transaction.atomic():
            current,locked=lock_current(domain,binding)
            if policy(current,locked).get("nonce")!=value["nonce"] or policy(current,locked).get("state")!="consented":
                raise Refused()
            writer_for(locked,value)
            current.metadata={**current.metadata,POLICY:signed(value)}
            current.save(update_fields=["metadata"])
            audit(request,current,"domain_dns_write_approved")
    elif action=="revoke":
        if request.user.role=="client":
            _customer(request,domain)
            shape(data,("confirm_password",))
            confirm(request,data["confirm_password"])
        else:
            _admin(request)
            shape(data,("confirm_password","totp_code"))
            check_mutation(request.user,data["confirm_password"],data["totp_code"])
        with transaction.atomic():
            current,locked=lock_current(domain,binding)
            current.metadata={**current.metadata,POLICY:signed({"identity":identity(current,locked),"state":"revoked"})}
            current.save(update_fields=["metadata"])
            audit(request,current,"domain_dns_write_revoked")
    else:
        raise Refused()
    return access(request,Domain.objects.get(pk=domain.pk))

def record_name(name,zone):
    if not isinstance(name,str) or not 1<=len(name)<=253 or name!=name.lower():
        raise Refused()
    name=zone if name=="@" else name
    if name!=zone and not name.endswith("."+zone):
        raise Refused()
    relative=name[:-len(zone)].removesuffix(".")
    labels=relative.split(".") if relative else []
    if any(not (LABEL.fullmatch(x) or UNDERSCORE.fullmatch(x)) for x in labels):
        raise Refused()
    if any(x in PROTECTED or x.startswith("_octalve") for x in labels):
        raise Refused()
    return name

def normalize(record,zone):
    if not isinstance(record,dict) or set(record)!={"name","type","value","ttl","priority"}:
        raise Refused()
    name=record_name(record["name"],zone)
    kind=record["type"]
    value=record["value"]
    ttl=record["ttl"]
    priority=record["priority"]
    if (not isinstance(kind,str) or kind not in KINDS or type(ttl) is not int
            or ttl not in (1,) and not 60<=ttl<=86400 or not isinstance(value,str)
            or not 1<=len(value)<=1024 or any(ord(x)<32 or ord(x)>126 for x in value)):
        raise Refused()
    if kind in ("A","AAAA"):
        address=ipaddress.ip_address(value)
        if address.version!=(4 if kind=="A" else 6) or not address.is_global:
            raise Refused()
        value=str(address)
    elif kind in ("CNAME","MX"):
        value=hostname(value)
        if kind=="CNAME" and (name==zone or name==value):
            raise Refused()
    elif kind=="TXT":
        # No ownership/challenge or structured escape mutation.
        if name==zone or any(x in value for x in ('"',"\\")) or len(value)>255:
            raise Refused()
    elif kind=="CAA":
        if not re.fullmatch(r'(?:0|128) (?:issue|issuewild|iodef) "[A-Za-z0-9.:/@;=_ -]{1,200}"',value):
            raise Refused()
    elif kind=="SRV":
        parts=value.split(" ")
        if len(parts)!=4 or any(not x.isdecimal() or not 0<=int(x)<=65535 for x in parts[:3]):
            raise Refused()
        value=" ".join([*(str(int(x)) for x in parts[:3]),hostname(parts[3])])
    if kind=="MX":
        if type(priority) is not int or not 0<=priority<=65535:
            raise Refused()
    elif priority is not None:
        raise Refused()
    return {"name":name,"type":kind,"value":value,"ttl":ttl,"priority":priority}

def comparable(row,zone):
    if row.get("proxied") is True:
        raise Refused()
    record={k:row.get(k) for k in ("name","type","value","ttl","priority")}
    if record["type"]!="MX":
        record["priority"]=None
    if record["type"]=="TXT" and isinstance(record["value"],str) and record["value"].startswith('"') and record["value"].endswith('"'):
        record["value"]=record["value"][1:-1]
    return normalize(record,zone)

@sensitive_variables("token","headers","response")
def send(token,zone,operation,record_id,record):
    zone=require_id(zone)
    path=f"/zones/{zone}/dns_records"
    if operation in ("edit","delete"):
        path+="/"+require_id(record_id)
    method={"create":"POST","edit":"PATCH","delete":"DELETE"}[operation]
    body=None
    if operation!="delete":
        body={"name":record["name"],"type":record["type"],"content":record["value"],"ttl":record["ttl"]}
        if record["type"] in ("A","AAAA","CNAME"):
            body["proxied"]=False
        if record["type"]=="MX":
            body["priority"]=record["priority"]
        elif record["type"]=="CAA":
            flags,tag,content=record["value"].split(" ",2)
            body.pop("content")
            body["data"]={"flags":int(flags),"tag":tag,"value":content[1:-1]}
        elif record["type"]=="SRV":
            priority,weight,port,target=record["value"].split(" ")
            body.pop("content")
            body["data"]={"priority":int(priority),"weight":int(weight),"port":int(port),"target":target}
    session=requests.Session()
    session.trust_env=False
    try:
        headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
        with session.request(method,API_ORIGIN+path,headers=headers,json=body,timeout=(3,8),allow_redirects=False,verify=True,stream=True) as response:
            if response.status_code not in (200,201):
                raise Refused()
            raw=bytearray()
            for chunk in response.iter_content(8192):
                raw.extend(chunk)
                if len(raw)>131072:
                    raise Refused()
            result=_require_result(json.loads(raw))
            if not isinstance(result,dict):
                raise Refused()
            actual=require_id(result.get("id"))
            if record_id and actual!=record_id:
                raise Refused()
            return actual
    except (requests.RequestException,ValueError,TypeError):
        raise Refused() from None
    finally:
        session.close()

def observed(rows,fence,zone):
    if fence["operation"]=="delete":
        return not any(r["id"]==fence["target"] for r in rows)
    matches=[]
    for row in rows:
        try:
            if digest(comparable(row,zone))==fence["desired"] and (not fence["target"] or row["id"]==fence["target"]):
                matches.append(row["id"])
        except (Refused,ValueError,DelegationUnavailable):
            continue
    return len(matches)==1 and matches[0] not in fence.get("before_ids",[])

@sensitive_variables("data","connector","writer")
def mutate(request,domain,reconcile=False):
    gate()
    _customer(request,domain)
    budget(request,domain)
    binding=binding_for(domain)
    value=policy(domain,binding)
    if value["state"]!="approved":
        raise Refused()
    writer=writer_for(binding,value)
    connector=_conn(writer,writer.current_version)
    before=snapshot(domain,binding,connector)
    previous=domain.metadata.get(FENCE)
    if reconcile:
        shape(request.data,())
        if not previous or previous.get("state")!="uncertain" or previous.get("identity")!=value["identity"] or previous.get("nonce")!=value["nonce"]:
            raise Refused()
        created=parse_datetime(previous["created_at"])
        if not created or timezone.now()-created<timedelta(minutes=2) or not observed(before["records"],previous,domain.domain_name):
            return Response({"state":"pending_verification"},status=202,headers=NO_CACHE)
        fence=previous
    else:
        data=request.data
        shape(data,("operation","record_id","record","snapshot_sha256","confirm_password","confirm_name"))
        confirm(request,data["confirm_password"])
        if previous and previous.get("state")=="uncertain":
            raise Refused()
        operation=data["operation"]
        if operation not in ("create","edit","delete") or data["snapshot_sha256"]!=before["snapshot_sha256"]:
            raise Refused()
        target=None if operation=="create" else require_id(data["record_id"])
        if operation=="create" and data["record_id"] is not None:
            raise Refused()
        old=None
        if target:
            matches=[row for row in before["records"] if row["id"]==target]
            if len(matches)!=1:
                raise Refused()
            old=comparable(matches[0],domain.domain_name)
        record=None if operation=="delete" else normalize(data["record"],domain.domain_name)
        if operation=="delete" and data["record"] is not None:
            raise Refused()
        if data["confirm_name"]!=(old or record)["name"] or old and record and (old["type"]!=record["type"] or old["name"]!=record["name"]):
            raise Refused()
        desired=digest(record) if record else None
        before_ids=[]
        if record:
            for row in before["records"]:
                try:
                    if digest(comparable(row,domain.domain_name))==desired:
                        before_ids.append(row["id"])
                except (Refused,ValueError,DelegationUnavailable):
                    continue
            if before_ids:
                raise Refused()
        fence={"id":str(uuid.uuid4()),"identity":value["identity"],"nonce":value["nonce"],
               "state":"uncertain","operation":operation,"target":target,"desired":desired,
               "before_ids":before_ids,"created_at":timezone.now().isoformat()}
        with transaction.atomic():
            current,locked=lock_current(domain,binding)
            if policy(current,locked)!=value or current.metadata.get(FENCE)!=previous:
                raise Refused()
            writer_for(locked,value)
            current.metadata={**current.metadata,FENCE:fence}
            current.save(update_fields=["metadata"])
            audit(request,current,"domain_dns_write_reserved",fence["id"])
        try:
            current=Domain.objects.get(pk=domain.pk)
            current_binding=binding_for(current)
            if policy(current,current_binding)!=value or current.metadata.get(FENCE)!=fence:
                raise Refused()
            fresh_writer=writer_for(current_binding,value)
            connector=_conn(fresh_writer,fresh_writer.current_version)
            send(connector.transport.token,binding.zone_id,operation,target,record)
            after=snapshot(current,current_binding,connector)
            if not observed(after["records"],fence,domain.domain_name):
                raise Refused()
        except (Refused,CloudflareINT01Denied,VaultUnavailable,DelegationUnavailable,DatabaseError,ValueError):
            return Response({"state":"pending_verification"},status=202,headers=NO_CACHE)
    with transaction.atomic():
        current,locked=lock_current(domain,binding)
        if policy(current,locked)!=value or current.metadata.get(FENCE)!=fence:
            raise Refused()
        writer_for(locked,value)
        current.metadata={**current.metadata,FENCE:{**fence,"state":"confirmed"}}
        current.save(update_fields=["metadata"])
        audit(request,current,"domain_dns_write_confirmed",fence["id"])
    return Response({"state":"confirmed","public_propagation_verified":False},headers=NO_CACHE)

def dispatch(request,domain,action):
    try:
        if action=="access":
            return access(request,domain)
        if action in ("consent","approve","revoke"):
            return authorize(request,domain,action)
        if action in ("mutate","reconcile"):
            return mutate(request,domain,reconcile=action=="reconcile")
        raise Refused()
    except (Refused,CloudflareINT01Denied,VaultUnavailable,DelegationUnavailable,DatabaseError,ValueError,TypeError,KeyError,AttributeError):
        return Response({"detail":"DNS write authority or operation could not be confirmed."},status=409,headers=NO_CACHE)
