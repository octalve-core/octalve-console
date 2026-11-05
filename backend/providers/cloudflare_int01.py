"""INT-01 Cloudflare connector: fixed-origin, bounded, API-token-only operations.

Does not use or write legacy Provider secrets. Live DNS requests are read-only.
Sandbox registration is an explicitly gated operator-only simulation, never a
paid domain, active Django Domain, billable order, or customer entitlement.
Cloudflare API docs: /resources/registrar_sandbox/ and /resources/zones/.
"""
import hashlib
import json
import os
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import requests

API_ORIGIN = "https://api.cloudflare.com/client/v4"
HEX_ID = re.compile(r"[a-fA-F0-9]{32}\Z")
DOMAIN = re.compile(r"(?=.{4,253}\Z)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net)\Z")
ALLOWED_STATES = {"pending", "in_progress", "action_required", "blocked", "succeeded", "failed"}
MAX_REPLY_BYTES = 131072

class CloudflareINT01Denied(ValueError):
    def __str__(self):
        return "Cloudflare connection or sandbox verification was refused."

def require_id(value):
    if not isinstance(value, str) or not HEX_ID.fullmatch(value):
        raise CloudflareINT01Denied()
    return value.lower()

def require_domain(value):
    if not isinstance(value,str) or not DOMAIN.fullmatch(value) or value!=value.lower():
        raise CloudflareINT01Denied()
    return value

def validate_money(value):
    if not isinstance(value,str) or not re.fullmatch(r"(?:0|[1-9][0-9]{0,9})\.[0-9]{2}",value):
        raise CloudflareINT01Denied()
    try:
        amount=Decimal(value)
    except InvalidOperation:
        raise CloudflareINT01Denied() from None
    if not amount.is_finite() or amount<=0:
        raise CloudflareINT01Denied()
    return value

def _require_result(reply):
    if not isinstance(reply,dict) or reply.get("success") is not True or reply.get("errors") not in ([],None):
        raise CloudflareINT01Denied()
    return reply.get("result")

def _check_domain(reply, domain):
    data=_require_result(reply)
    rows=data.get("domains") if isinstance(data,dict) else None
    if not isinstance(rows,list) or len(rows)!=1 or not isinstance(rows[0],dict):
        raise CloudflareINT01Denied()
    row=rows[0]
    if row.get("name")!=domain or type(row.get("registrable")) is not bool:
        raise CloudflareINT01Denied()
    if row["registrable"]:
        if row.get("tier")!="standard" or not isinstance(row.get("pricing"),dict):
            raise CloudflareINT01Denied()
        price=row["pricing"]
        if not re.fullmatch(r"[A-Z]{3}",str(price.get("currency",""))):
            raise CloudflareINT01Denied()
        register=validate_money(price.get("registration_cost"))
        renewal=validate_money(price.get("renewal_cost"))
        return {"name":domain,"registrable":True,"tier":"standard",
                "currency":price["currency"],"registration_cost":register,"renewal_cost":renewal}
    reason=row.get("reason")
    if reason not in ("extension_not_supported_via_api","extension_not_supported",
                      "extension_disallows_registration","domain_premium","domain_unavailable"):
        raise CloudflareINT01Denied()
    return {"name":domain,"registrable":False,"reason":reason}

def _registration(reply,domain):
    data=_require_result(reply)
    if not isinstance(data,dict) or data.get("domain_name")!=domain:
        raise CloudflareINT01Denied()
    status=data.get("status")
    if status not in ("active","registration_pending","transfer_pending","expired","suspended",
                      "redemption_period","pending_delete"):
        raise CloudflareINT01Denied()
    return {"domain_name":domain,"sandbox_status":status,
            "has_expiry":bool(data.get("expires_at"))}

def _workflow(reply,domain):
    value=_require_result(reply)
    if not isinstance(value,dict) or value.get("state") not in ALLOWED_STATES or type(value.get("completed")) is not bool:
        raise CloudflareINT01Denied()
    context=value.get("context")
    if isinstance(context,dict) and context.get("domain_name") not in (None,domain):
        raise CloudflareINT01Denied()
    state=value["state"]
    if value["completed"] != (state in ("succeeded","failed")):
        raise CloudflareINT01Denied()
    return {"domain_name":domain,"state":state,"completed":value["completed"],
            "sandbox_only":True,"public_dns_created":False}

class FixedCloudflareTransport:
    """Fixed Cloudflare endpoint. No URL, redirect, proxy or host supplied by users."""
    def __init__(self,token,session=None):
        if not isinstance(token,str) or not 20<=len(token)<=512 or token!=token.strip() or any(ord(c)<33 or ord(c)>126 for c in token):
            raise CloudflareINT01Denied()
        self.token=token
        self.session=session or requests.Session()
        self.session.trust_env=False  # Do not follow proxy config or .netrc credentials.
        self.session.headers.clear()

    def __call__(self,method,path,body=None):
        if method not in ("GET","POST") or not isinstance(path,str) or not path.startswith("/"):
            raise CloudflareINT01Denied()
        # Network operations are defined solely in the adapter below; reject
        # generic paths and arbitrary request bodies even if called directly.
        if not re.fullmatch(r"/zones(?:/[a-f0-9]{32}/dns_records)?|/accounts/[a-f0-9]{32}/registrar-sandbox/(?:domain-check|extensions/(?:com|net)|registrations(?:/[a-z0-9.-]+)?)|/accounts/[a-f0-9]{32}/registrar/domain-check",path):
            raise CloudflareINT01Denied()
        is_register=path.endswith("/registrations")
        is_check=path.endswith("/domain-check")
        if method=="POST" and not (is_register or is_check):
            raise CloudflareINT01Denied()
        if method=="GET" and is_check:
            raise CloudflareINT01Denied()
        if method=="POST":
            if not isinstance(body,dict) or (set(body)!={"domains"} if is_check else set(body)!={"domain_name","years","auto_renew","privacy_mode"}):
                raise CloudflareINT01Denied()
        elif body is not None:
            raise CloudflareINT01Denied()
        if method=="POST":
            if is_check:
                if (not isinstance(body.get("domains"),list)
                    or len(body["domains"])!=1):
                    raise CloudflareINT01Denied()
                require_domain(body["domains"][0])
            else:
                require_domain(body["domain_name"])
                if body["years"]!=1 or body["auto_renew"] is not False or body["privacy_mode"]!="redaction":
                    raise CloudflareINT01Denied()
        headers={"Authorization":"Bearer "+self.token,"Accept":"application/json"}
        if method=="POST": headers["Content-Type"]="application/json"
        try:
            response=self.session.request(method,API_ORIGIN+path,headers=headers,
                json=body if method=="POST" else None,
                timeout=(3,8),allow_redirects=False,verify=True,stream=True)
            with response:
                if response.status_code not in (200,201,202):
                    raise CloudflareINT01Denied()
                if response.headers.get("content-length"):
                    try:
                        if int(response.headers["content-length"])>MAX_REPLY_BYTES:
                            raise CloudflareINT01Denied()
                    except ValueError:
                        raise CloudflareINT01Denied() from None
                data=bytearray()
                for chunk in response.iter_content(chunk_size=8192):
                    data.extend(chunk)
                    if len(data)>MAX_REPLY_BYTES:
                        raise CloudflareINT01Denied()
                return json.loads(bytes(data).decode("utf-8"))
        except (requests.RequestException,ValueError,UnicodeError) as exc:
            raise CloudflareINT01Denied() from exc

@dataclass
class CloudflareINT01:
    account_id: str
    transport: object

    def __post_init__(self):
        self.account_id=require_id(self.account_id)

    def _path(self,append):
        return f"/accounts/{self.account_id}/registrar-sandbox/{append}"

    def live_domain_check(self, domain):
        """Cloudflare Registrar beta's live price/availability check, NOT a purchase.

        A POST to domain-check is a read-only query; the transport permits no
        path ending in /registrar/registrations, including indirect callers.
        Only .com and .net are initially qualified; widen with vendor tests.
        """
        domain=require_domain(domain)
        data=self.transport("POST",f"/accounts/{self.account_id}/registrar/domain-check",
                            {"domains":[domain]})
        return _check_domain(data,domain)

    def dns_readback(self,zone_id):
        zone_id=require_id(zone_id)
        # zone ownership must be independently approved and match known account.
        zones=_require_result(self.transport("GET","/zones"))
        if not isinstance(zones,list) or not any(
            isinstance(zone,dict) and zone.get("id")==zone_id and
            isinstance(zone.get("account"),dict) and zone["account"].get("id")==self.account_id
            and zone.get("status")=="active" for zone in zones):
            raise CloudflareINT01Denied()
        rows=_require_result(self.transport("GET",f"/zones/{zone_id}/dns_records"))
        if not isinstance(rows,list) or len(rows)>100:
            raise CloudflareINT01Denied()
        for row in rows:
            if not isinstance(row,dict) or not isinstance(row.get("name"),str) or not isinstance(row.get("type"),str):
                raise CloudflareINT01Denied()
        digest=hashlib.sha256(json.dumps(
            [(x["name"],x["type"],str(x.get("content",""))) for x in rows],
            separators=(",",":"),sort_keys=True).encode()).hexdigest()
        return {"zone_id":zone_id,"zone_verified":True,"dns_record_count":len(rows),
                "record_digest_sha256":digest,"side_effects":False}

    def sandbox_readback(self):
        rows=_require_result(self.transport("GET",self._path("registrations")))
        if not isinstance(rows,list) or len(rows)>50:
            raise CloudflareINT01Denied()
        for row in rows:
            if not isinstance(row,dict) or not isinstance(row.get("domain_name"),str):
                raise CloudflareINT01Denied()
        return {"sandbox_authenticated":True,"sandbox_registration_count_page":len(rows),
                "real_domain_created":False,"side_effects":False}

    def check(self,domain):
        domain=require_domain(domain)
        response=self.transport("POST",self._path("domain-check"),{"domains":[domain]})
        return _check_domain(response,domain)

    def extension(self,extension):
        if extension not in ("com","net"):
            raise CloudflareINT01Denied()
        data=_require_result(self.transport("GET",self._path("extensions/"+extension)))
        if not isinstance(data,dict) or "registration_schema" not in data:
            raise CloudflareINT01Denied()
        return {"extension":extension,"schema_received":True}

    def get_registration(self,domain):
        domain=require_domain(domain)
        return _registration(self.transport("GET",self._path("registrations/"+domain)),domain)

    def simulate_registration(self,domain,*,operator_approved=False):
        """Only sandbox POST. Explicit approval; one attempt, NEVER automatic retry.

        A timeout/202 leaves outcome uncertain: operator must reconcile via
        GET before any further POST. Sandbox does not create real domains/DNS.
        """
        domain=require_domain(domain)
        if (operator_approved is not True or
            os.environ.get("INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED")!="true" or
            os.environ.get("VERCEL")=="1"):
            raise CloudflareINT01Denied()
        available=self.check(domain)
        if not available["registrable"]:
            raise CloudflareINT01Denied()
        self.extension(domain.rsplit(".",1)[1])
        result=self.transport("POST",self._path("registrations"),{
            "domain_name":domain,"years":1,"auto_renew":False,"privacy_mode":"redaction"})
        outcome=_workflow(result,domain)
        if outcome["state"]=="succeeded":
            # A successful workflow is not enough; verify the resource exists.
            confirmation=self.get_registration(domain)
            if confirmation["sandbox_status"]!="active":
                raise CloudflareINT01Denied()
            return {**outcome,"confirmation":confirmation}
        return outcome

def from_operator_environment(scope):
    if scope not in ("dns","sandbox"):
        raise CloudflareINT01Denied()
    account=os.getenv("INT01_CLOUDFLARE_ACCOUNT_ID","")
    token=os.getenv("INT01_CLOUDFLARE_DNS_TOKEN" if scope=="dns" else "INT01_CLOUDFLARE_SANDBOX_TOKEN","")
    return CloudflareINT01(account,FixedCloudflareTransport(token))
