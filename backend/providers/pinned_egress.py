"""Default-deny HTTPS GET: connect to an approved public IP with original-host TLS."""
import ipaddress
import json
import os
import re
from urllib.parse import urlsplit
import certifi
import requests
import urllib3
from django.conf import settings

class SupplierEgressDenied(requests.RequestException):
    def __str__(self):
        return "Supplier network access was not authorized."

class SupplierReadResponse:
    def __init__(self,status,body):
        self.status_code=status
        self.content=body
    @property
    def text(self):
        return self.content.decode("utf-8",errors="replace")
    def json(self):
        return json.loads(self.content.decode("utf-8"))

def approved_origin(url):
    if not getattr(settings,"CLOUD_SUPPLIER_PINNED_READBACK_ENABLED",False):
        raise SupplierEgressDenied()
    if not isinstance(url,str) or len(url)>500 or any(ord(c)<33 for c in url):
        raise SupplierEgressDenied()
    parts=urlsplit(url)
    if (parts.scheme!="https" or not parts.hostname or parts.username or parts.password or
        parts.query or parts.fragment or not parts.path.startswith("/")):
        raise SupplierEgressDenied()
    host=parts.hostname.lower().rstrip(".")
    if host!=parts.hostname or host.endswith(".local") or "." not in host:
        raise SupplierEgressDenied()
    try:
        ipaddress.ip_address(host)
        raise SupplierEgressDenied()
    except ValueError:
        pass
    try: port=parts.port or 443
    except ValueError: raise SupplierEgressDenied()
    if port not in (443,2087,2222): raise SupplierEgressDenied()
    allowed={s.strip().lower().rstrip(".") for s in os.getenv("CLOUD_INVENTORY_ALLOWED_HOSTS","").split(",") if s.strip()}
    if host not in allowed: raise SupplierEgressDenied()
    try: pins=json.loads(getattr(settings,"CLOUD_SUPPLIER_PINNED_IPS_JSON","") or "{}")
    except (ValueError,TypeError): raise SupplierEgressDenied()
    if not isinstance(pins,dict) or len(pins)>64 or host not in pins or not isinstance(pins[host],str):
        raise SupplierEgressDenied()
    try: ip=ipaddress.ip_address(pins[host])
    except ValueError: raise SupplierEgressDenied()
    if not ip.is_global or ip.is_multicast or ip.is_link_local or ip.is_loopback or ip.is_private or ip.is_reserved or ip.is_unspecified or getattr(ip,"ipv4_mapped",None):
        raise SupplierEgressDenied()
    return host,port,str(ip),parts.path

def validate_readback_contract(path,port,params,headers):
    """Allow only the four code-owned read-only vendor API operations.

    Enforce header/parameter shape before any network or credential-bearing
    request. Never accept a browser-supplied path or arbitrary GET function.
    """
    if not isinstance(params,dict) or not isinstance(headers,dict):
        raise SupplierEgressDenied()
    if set(headers)!={"Accept","Authorization"} or headers.get("Accept")!="application/json":
        raise SupplierEgressDenied()
    auth=headers.get("Authorization")
    if not isinstance(auth,str) or len(auth)>8192 or any(ord(c)<32 or ord(c)==127 for c in auth):
        # Authorization contains one separator space, so validate below.
        raise SupplierEgressDenied()
    # Standard read-only inventory on DirectAdmin.
    if path=="/CMD_API_PACKAGES_USER" and port in (2222,443):
        if not re.fullmatch(r"Basic [A-Za-z0-9+/]+={0,2}",auth):
            raise SupplierEgressDenied()
        if params and (set(params)!={"package"} or not isinstance(params.get("package"),str) or
                       not 1<=len(params["package"])<=200 or
                       any(ord(c)<32 for c in params["package"])):
            raise SupplierEgressDenied()
        return
    if path=="/CMD_API_SHOW_USER_CONFIG" and port in (2222,443):
        if (not re.fullmatch(r"Basic [A-Za-z0-9+/]+={0,2}",auth) or
            set(params)!={"user"} or not isinstance(params["user"],str) or
            not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{1,31}",params["user"])):
            raise SupplierEgressDenied()
        return
    if path=="/json-api/listpkgs" and port in (2087,443):
        if (not re.fullmatch(r"whm [A-Za-z0-9_.-]{1,80}:[^\\r\\n]{12,4096}",auth) or
            params!={"api.version":"1","want":"creatable"}):
            raise SupplierEgressDenied()
        return
    if path=="/json-api/accountsummary" and port in (2087,443):
        if (not re.fullmatch(r"whm [A-Za-z0-9_.-]{1,80}:[^\\r\\n]{12,4096}",auth) or
            set(params)!={"api.version","user"} or params.get("api.version")!="1" or
            not isinstance(params.get("user"),str) or
            not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{1,31}",params["user"])):
            raise SupplierEgressDenied()
        return
    raise SupplierEgressDenied()


def pinned_get(url,*,params,headers,timeout,allow_redirects,verify):
    if allow_redirects is not False or verify is not True: raise SupplierEgressDenied()
    host,port,ip,path=approved_origin(url)
    if not isinstance(params,dict) or len(params)>10 or not isinstance(headers,dict) or not isinstance(timeout,(float,int)) or not 0<timeout<=15:
        raise SupplierEgressDenied()
    validate_readback_contract(path,port,params,headers)
    pool=None
    try:
        pool=urllib3.HTTPSConnectionPool(host=ip,port=port,server_hostname=host,assert_hostname=host,
            cert_reqs="CERT_REQUIRED",ca_certs=certifi.where(),
            timeout=urllib3.Timeout(connect=min(4,timeout),read=timeout),
            retries=False,maxsize=1,block=True)
        safe_headers=dict(headers)
        safe_headers["Host"]=host if port==443 else f"{host}:{port}"
        response=pool.request("GET",path,fields=params,headers=safe_headers,
                              redirect=False,retries=False,preload_content=False)
        try:
            if 300<=response.status<400: raise SupplierEgressDenied()
            try:
                if int(response.headers.get("content-length","0"))>1_000_000:
                    raise SupplierEgressDenied()
            except ValueError: raise SupplierEgressDenied()
            content=response.read(1_000_001)
            if len(content)>1_000_000: raise SupplierEgressDenied()
            return SupplierReadResponse(response.status,content)
        finally:
            response.release_conn()
            response.close()
    except SupplierEgressDenied:
        raise
    except (urllib3.exceptions.HTTPError,OSError,ValueError) as exc:
        raise SupplierEgressDenied() from exc
    finally:
        if pool is not None: pool.close()
