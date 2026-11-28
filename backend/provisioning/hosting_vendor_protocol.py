"""Strict, code-owned vendor account create and readback protocol.

No public endpoint or generic URL forwarding. This module is deliberately
not a standalone execution authority: a durable paid-order worker must
reserve a dispatch, prove domain entitlement and qualify the exact vault
connection before invoking any write.
"""
import base64
import re
from urllib.parse import parse_qs, urlencode
import certifi
import urllib3
from django.conf import settings
from providers.pinned_egress import approved_origin, SupplierEgressDenied, SupplierReadResponse
from provisioning.account_creation_plan import AccountCreationPlan, CreationPlanRefused
from provisioning.vendor_create_contract import compile_account_create, NAME

class VendorProtocolRefused(ValueError):
    pass


def _fields(text):
    if not isinstance(text,str) or not text or len(text)>100000:
        raise VendorProtocolRefused("Invalid supplier response.")
    data=parse_qs(text,keep_blank_values=True,max_num_fields=500)
    if any(len(values)!=1 for values in data.values()):
        raise VendorProtocolRefused("Ambiguous supplier response.")
    return {k:v[0] for k,v in data.items()}


def _whm(response,command):
    try:
        body=response.json()
        meta=body["metadata"]
        if not isinstance(meta,dict) or meta.get("command")!=command or type(meta.get("result")) not in (int,str) or str(meta["result"])!="1":
            raise VendorProtocolRefused("Supplier did not confirm the request.")
        return body
    except (TypeError,ValueError,KeyError,AttributeError):
        raise VendorProtocolRefused("Invalid supplier response.") from None


def _assert_plan(plan):
    if not isinstance(plan,AccountCreationPlan):
        raise VendorProtocolRefused("Invalid account plan.")
    # Compile using a fixed throwaway fixture solely to validate the shape.
    # Actual credentials are generated separately for the real create.
    try:
        compile_account_create(plan,make_password=lambda:"x"*40)
    except CreationPlanRefused:
        raise VendorProtocolRefused("Invalid account plan.") from None


def verify_account_absent(plan,response):
    """Do not treat a timeout, error, 404 or malformed body as absence."""
    _assert_plan(plan)
    if response.status_code!=200:
        raise VendorProtocolRefused("Account absence was not confirmed.")
    if plan.adapter_type=="DirectAdminAdapter":
        fields=_fields(response.text)
        if fields.get("error")!="0" or fields.get("exists")!="0":
            raise VendorProtocolRefused("Account absence was not confirmed.")
    else:
        body=_whm(response,"listaccts")
        rows=body.get("data",{}).get("acct")
        if not isinstance(rows,list) or rows:
            raise VendorProtocolRefused("Account absence was not confirmed.")
    return True


def verify_created_account(plan,response):
    """Strict username, domain, owner, package, email and unsuspended proof."""
    _assert_plan(plan)
    if response.status_code!=200:
        raise VendorProtocolRefused("Account was not independently confirmed.")
    if plan.adapter_type=="DirectAdminAdapter":
        fields=_fields(response.text)
        expected={"username":plan.username,"creator":plan.reseller_owner,
                  "domain":plan.domain,"package":plan.package,"email":plan.email,
                  "usertype":"user","account":"ON","suspended":"no"}
        if fields.get("error","0")!="0" or any(fields.get(k)!=v for k,v in expected.items()):
            raise VendorProtocolRefused("Account identity or package was not confirmed.")
    else:
        body=_whm(response,"accountsummary")
        rows=body.get("data",{}).get("acct")
        if not isinstance(rows,list) or len(rows)!=1 or not isinstance(rows[0],dict):
            raise VendorProtocolRefused("Account identity is ambiguous.")
        row=rows[0]
        expected={"user":plan.username,"owner":plan.reseller_owner,
                  "domain":plan.domain,"plan":plan.package,"email":plan.email}
        if any(row.get(k)!=v for k,v in expected.items()) or str(row.get("suspended")).lower() not in ("0","false"):
            raise VendorProtocolRefused("Account identity or package was not confirmed.")
    return True


def verify_create_response(plan,response):
    """A create acknowledgement is NOT activation; always require readback."""
    _assert_plan(plan)
    if response.status_code!=200:
        raise VendorProtocolRefused("Creation outcome is uncertain.")
    if plan.adapter_type=="DirectAdminAdapter":
        if _fields(response.text).get("error")!="0":
            raise VendorProtocolRefused("Creation outcome is uncertain.")
    else:
        _whm(response,"createacct")
    return True


class PinnedHostingProtocol:
    """Exact plan-bound protocol. Transport is private, fixed and non-retrying."""
    def __init__(self,plan,origin,username,token):
        _assert_plan(plan)
        if (not isinstance(username,str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{1,79}",username)
                or not isinstance(token,str) or not 12<=len(token)<=4096
                or any(ord(ch)<33 or ord(ch)>126 for ch in token)):
            raise VendorProtocolRefused("Invalid supplier credentials.")
        if username=="root":
            raise VendorProtocolRefused("Use an independently qualified restricted supplier account.")
        self.plan=plan
        self._origin=origin.rstrip("/")
        self._auth=("Basic "+base64.b64encode((username+":"+token).encode()).decode()
                    if plan.adapter_type=="DirectAdminAdapter" else "whm "+username+":"+token)
        self._da=plan.adapter_type=="DirectAdminAdapter"

    def _request(self,method,path,fields):
        # Never use the generic requests client, URL redirects, DNS resolution,
        # retries, proxies, or a request path provided by a browser.
        host,port,ip,checked_path=approved_origin(self._origin+path)
        if checked_path!=path or port not in ((2222,443) if self._da else (2087,443)):
            raise SupplierEgressDenied()
        pool=urllib3.HTTPSConnectionPool(host=ip,port=port,server_hostname=host,
            assert_hostname=host,cert_reqs="CERT_REQUIRED",ca_certs=certifi.where(),
            timeout=urllib3.Timeout(connect=3,read=8),retries=False,maxsize=1,block=True)
        headers={"Authorization":self._auth,"Accept":"application/json",
                 "Host":host if port==443 else f"{host}:{port}"}
        try:
            if method=="POST":
                headers["Content-Type"]="application/x-www-form-urlencoded"
                response=pool.request(method,path,body=urlencode(fields).encode(),
                    headers=headers,redirect=False,retries=False,preload_content=False)
            else:
                response=pool.request(method,path,fields=fields,headers=headers,
                    redirect=False,retries=False,preload_content=False)
            try:
                if 300<=response.status<400 or int(response.headers.get("content-length","0"))>100000:
                    raise VendorProtocolRefused("Unconfirmed supplier response.")
                body=response.read(100001)
                if len(body)>100000:
                    raise VendorProtocolRefused("Oversized supplier response.")
                return SupplierReadResponse(response.status,body)
            finally:
                response.close()
                response.release_conn()
        except (urllib3.exceptions.HTTPError,ValueError,OSError):
            raise VendorProtocolRefused("Supplier response could not be confirmed.") from None
        finally:
            pool.close()

    def absent(self):
        p=self.plan
        if self._da:
            reply=self._request("GET","/CMD_API_USER_EXISTS",{"user":p.username})
        else:
            reply=self._request("GET","/json-api/listaccts",{"api.version":"1",
                "searchtype":"user","searchmethod":"exact","search":p.username})
        return verify_account_absent(p,reply)

    def create(self,*,dispatch_authorized=False,shared_ip=None):
        # This transport alone cannot establish authorization. The production
        # dispatcher must independently qualify and reserve this exact plan.
        if not dispatch_authorized or not getattr(settings,"CLOUD_HOSTING_VENDOR_CREATE_ENABLED",False):
            raise VendorProtocolRefused("Supplier account creation is disabled.")
        spec=compile_account_create(self.plan)
        if self._da:
            # DA expects an available shared address; never assume the word
            # 'shared' is accepted on the supplier's server.
            import ipaddress
            try:
                addr=ipaddress.ip_address(shared_ip)
                if not addr.is_global or addr.is_multicast:
                    raise ValueError()
            except (ValueError,TypeError):
                raise VendorProtocolRefused("An approved shared hosting IP is required.") from None
            fields={**spec.form,"ip":str(addr)}
        else:
            fields=spec.query
        return verify_create_response(self.plan,self._request(spec.method,spec.path,fields))

    def readback(self):
        if self._da:
            reply=self._request("GET","/CMD_API_SHOW_USER_CONFIG",{"user":self.plan.username})
        else:
            reply=self._request("GET","/json-api/accountsummary",{"api.version":"1","user":self.plan.username})
        return verify_created_account(self.plan,reply)
