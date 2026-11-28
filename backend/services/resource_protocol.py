"""Fixed, account-scoped resource protocol; no generic browser-controlled proxy.

Vendor write acknowledgement is never a success receipt. The service authority
must reserve a mutation and independently read back the resource.
"""
import base64
import re
from urllib.parse import parse_qs, urlencode

import certifi
import urllib3
from providers.pinned_egress import approved_origin, SupplierReadResponse, SupplierEgressDenied

ACCOUNT = re.compile(r"[A-Za-z][A-Za-z0-9_-]{1,31}\Z")
LOCAL = re.compile(r"[a-z0-9][a-z0-9._-]{0,63}\Z")
LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")


class ResourceRefused(ValueError):
    """Redacted supplier failure."""


def domain_name(value):
    if not isinstance(value, str) or not 3 <= len(value) <= 253 or value != value.lower():
        raise ResourceRefused("Invalid hosting domain.")
    labels = value.split(".")
    if len(labels) < 2 or not all(LABEL.fullmatch(x) for x in labels):
        raise ResourceRefused("Invalid hosting domain.")
    return value


def mailbox_name(value):
    if (not isinstance(value, str) or not LOCAL.fullmatch(value)
            or ".." in value or value.endswith(".")
            or value in {"root", "admin", "cpanel", "postmaster", "abuse", "mailer-daemon", "webmaster"}):
        raise ResourceRefused("Invalid or reserved mailbox name.")
    return value


def _form(response, *, empty=False):
    if response.status_code != 200 or len(response.content) > 200000:
        raise ResourceRefused("Supplier response unavailable.")
    try:
        if not response.content and empty:
            # Legacy empty reply is NOT proof of absence; use explicit
            # documented JSON/array shape, never infer from an empty body.
            raise ValueError()
        data = parse_qs(response.text, keep_blank_values=True, strict_parsing=True, max_num_fields=2000)
        if not data or ("error" in data and data["error"] != ["0"]):
            raise ValueError()
        return data
    except ValueError:
        raise ResourceRefused("Invalid supplier response.") from None


def _uapi(response, module, function):
    if response.status_code != 200 or len(response.content) > 200000:
        raise ResourceRefused("Supplier response unavailable.")
    try:
        body = response.json()
        meta, uapi = body["metadata"], body["data"]["uapi"]
        result = uapi["result"]
        if (meta["command"] != "uapi_cpanel" or str(meta["result"]) != "1"
                or uapi["module"] != module or uapi["func"] != function
                or str(result["status"]) != "1" or result.get("errors")):
            raise ValueError()
        return result["data"]
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ResourceRefused("Supplier operation not confirmed.") from None


def _list_names(data):
    if not isinstance(data, list) or len(data) > 2000:
        raise ResourceRefused("Invalid resource inventory.")
    if not all(isinstance(x, str) and 1 <= len(x) <= 253 for x in data):
        raise ResourceRefused("Invalid resource inventory.")
    if len(data) != len(set(data)):
        raise ResourceRefused("Duplicate supplier resource.")
    return data


def _legacy_list(response):
    """Legacy array must have an explicit list key (blank entry means empty)."""
    fields = _form(response, empty=True)
    if set(fields) - {"error", "list[]", "list"} or ("list" in fields and "list[]" in fields):
        raise ResourceRefused("Unexpected supplier inventory.")
    rows = fields.get("list[]", fields.get("list"))
    if rows == [""]:
        return []
    return _list_names(rows)


def _count(value, *, unlimited=False):
    if unlimited and isinstance(value, str) and value.lower() == "unlimited":
        return None
    if type(value) is int and 0 <= value <= 2**31-1:
        return value
    if isinstance(value, str) and re.fullmatch(r"[0-9]{1,10}", value):
        result = int(value)
        if result <= 2**31-1:
            return result
    raise ResourceRefused("Invalid resource limit.")


class ResourceProtocol:
    """One service-bound adapter. All paths and parameter keys are code-owned."""
    def __init__(self, service, provider, row, key):
        self.domain = domain_name(service.domain_name)
        self.account = service.provider_identifier
        owner = provider.username
        if (not isinstance(self.account, str) or not ACCOUNT.fullmatch(self.account)
                or not isinstance(owner, str) or not ACCOUNT.fullmatch(owner)
                or self.account.lower() in (owner.lower(), "admin", "root")
                or owner.lower() in ("admin", "root")
                or not isinstance(key, str) or not 12 <= len(key) <= 4096
                or any(ord(c) < 33 or ord(c) > 126 for c in key)):
            raise ResourceRefused("Invalid supplier authority.")
        self.adapter = row.adapter_key
        if self.adapter not in ("directadmin", "cpanel-whm"):
            raise ResourceRefused("Unsupported supplier.")
        self.origin = row.public_settings["server_url"]
        self.binding = (self.origin, row.public_settings["server_ip"])
        self._reseller_auth = ("Basic " + base64.b64encode((owner+":"+key).encode()).decode()
                               if self.adapter=="directadmin" else "whm "+owner+":"+key)
        self._auth = ("Basic " + base64.b64encode((owner+"|"+self.account+":"+key).encode()).decode()
                      if self.adapter == "directadmin" else "whm "+owner+":"+key)

    def _check_request(self, method, path, fields, reseller):
        """Deny undeclared operations even if a future caller misuses transport."""
        if not isinstance(fields, dict) or any(not isinstance(v,str) for v in fields.values()):
            raise ResourceRefused("Invalid supplier request.")
        if self.adapter == "directadmin":
            if reseller:
                valid = (method == "GET" and path in ("/CMD_API_SHOW_USER_CONFIG", "/CMD_API_SHOW_USER_USAGE") and fields == {"user": self.account})
            elif path == "/CMD_API_POP":
                valid = ((method == "GET" and fields == {"action":"full_list","domain":self.domain,"json":"yes"}) or
                         (method == "POST" and set(fields)=={"action","domain","user","passwd","passwd2","quota"} and fields["action"]=="create" and fields["domain"]==self.domain and fields["passwd"]==fields["passwd2"]))
            else:
                valid = method=="GET" and path=="/CMD_API_SUBDOMAINS" and fields=={"domain":self.domain}
        else:
            common={"api.version","cpanel.user","cpanel.module","cpanel.function"}
            valid=False
            if not reseller and path=="/json-api/uapi_cpanel" and fields.get("api.version")=="1" and fields.get("cpanel.user")==self.account:
                op=(method,fields.get("cpanel.module"),fields.get("cpanel.function"))
                allowed={("GET","Email","list_pops_with_disk"):{"domain","no_validate"},
                         ("GET","DomainInfo","list_domains"):set(),
                         ("POST","Email","add_pop"):{"email","domain","password","quota"},
                         ("GET","StatsBar","get_stats"):{"display"}}
                valid=op in allowed and set(fields)==common|allowed[op]
                if "domain" in fields:
                    valid=valid and fields["domain"]==self.domain
                if "no_validate" in fields:
                    valid=valid and fields["no_validate"]=="0"
                if "display" in fields:
                    valid=valid and fields["display"]=="emailaccounts|diskusage"
        if not valid:
            raise ResourceRefused("Supplier operation not allowed.")

    def _request(self, method, path, fields, *, reseller=False):
        self._check_request(method,path,fields,reseller)
        # Private transport; callers below compile fixed operations. POST
        # carries secrets only in the body, never URL/query/logs.
        host, port, ip, checked = approved_origin(self.origin+path, bound_origin=self.binding)
        if checked != path or port not in ((2222,443) if self.adapter=="directadmin" else (2087,443)):
            raise SupplierEgressDenied()
        pool = urllib3.HTTPSConnectionPool(host=ip, port=port, server_hostname=host,
            assert_hostname=host, cert_reqs="CERT_REQUIRED", ca_certs=certifi.where(),
            timeout=urllib3.Timeout(connect=3, read=6), retries=False, maxsize=1, block=True)
        headers = {"Authorization":self._reseller_auth if reseller else self._auth,"Accept":"application/json",
                   "Host":host if port==443 else f"{host}:{port}"}
        try:
            if method=="POST":
                headers["Content-Type"]="application/x-www-form-urlencoded"
                args={"body":urlencode(fields).encode()}
            elif method=="GET":
                args={"fields":fields}
            else:
                raise ResourceRefused("Invalid supplier operation.")
            response=pool.request(method,path,headers=headers,redirect=False,retries=False,
                                  preload_content=False,**args)
            try:
                if (300<=response.status<400 or int(response.headers.get("content-length","0"))>200000):
                    raise ResourceRefused("Supplier response unavailable.")
                data=response.read(200001)
                if len(data)>200000:
                    raise ResourceRefused("Supplier response unavailable.")
                return SupplierReadResponse(response.status,data)
            finally:
                response.close()
                response.release_conn()
        except (urllib3.exceptions.HTTPError,ValueError,OSError):
            raise ResourceRefused("Supplier response unavailable.") from None
        finally:
            pool.close()

    def _whm(self, method, module, function, fields):
        response=self._request(method,"/json-api/uapi_cpanel",{
            "api.version":"1","cpanel.user":self.account,
            "cpanel.module":module,"cpanel.function":function,**fields})
        return _uapi(response,module,function)

    def mailboxes(self):
        """Return only actual virtual mailboxes on the assigned domain."""
        if self.adapter=="directadmin":
            # Force documented JSON mode so an empty object is distinct from
            # an empty transport reply. Server-version shape still needs acceptance.
            response=self._request("GET","/CMD_API_POP",{
                "action":"full_list","domain":self.domain,"json":"yes"})
            if response.status_code!=200 or len(response.content)>200000:
                raise ResourceRefused("Supplier response unavailable.")
            try:
                fields=response.json()
            except (ValueError,TypeError):
                raise ResourceRefused("Invalid mailbox inventory.") from None
            if not isinstance(fields,dict) or len(fields)>2000:
                raise ResourceRefused("Invalid mailbox inventory.")
            rows=[]
            for local, details in fields.items():
                if not LOCAL.fullmatch(local) or not isinstance(details,dict) or "quota" not in details:
                    raise ResourceRefused("Invalid mailbox quota.")
                quota=_count(details["quota"])
                rows.append({"address":local+"@"+self.domain,
                             "quota_mb":quota if quota else None,
                             "unlimited":quota==0})
        else:
            result=self._whm("GET","Email","list_pops_with_disk",{"domain":self.domain,"no_validate":"0"})
            if not isinstance(result,list) or len(result)>2000:
                raise ResourceRefused("Invalid mailbox inventory.")
            rows=[]
            for item in result:
                if not isinstance(item,dict):
                    raise ResourceRefused("Invalid mailbox inventory.")
                address=item.get("email")
                if address=="Main Account" or address==self.account:
                    continue
                if not isinstance(address,str):
                    raise ResourceRefused("Invalid mailbox identity.")
                local,sep,domain=address.partition("@")
                if not sep or not LOCAL.fullmatch(local) or domain!=self.domain:
                    raise ResourceRefused("Unexpected mailbox domain.")
                quota=_count(item.get("txtdiskquota"),unlimited=True)
                rows.append({"address":address,"quota_mb":quota,"unlimited":quota is None})
        if len(rows)>2000 or len({x["address"] for x in rows})!=len(rows):
            raise ResourceRefused("Ambiguous mailbox inventory.")
        return sorted(rows,key=lambda x:x["address"])

    def subdomains(self):
        if self.adapter=="directadmin":
            raw=_legacy_list(self._request("GET","/CMD_API_SUBDOMAINS",{"domain":self.domain}))
            names=[x+"."+self.domain if LABEL.fullmatch(x) else x for x in raw]
        else:
            data=self._whm("GET","DomainInfo","list_domains",{})
            if not isinstance(data,dict) or data.get("main_domain")!=self.domain:
                raise ResourceRefused("Unexpected hosting domain.")
            names=_list_names(data.get("sub_domains"))
            # Addon-domain subdomains are not managed in this primary-domain scope.
            names=[x for x in names if x.endswith("."+self.domain)]
        for name in names:
            if domain_name(name)!=name or not name.endswith("."+self.domain):
                raise ResourceRefused("Unexpected subdomain.")
        return sorted(names)

    def create_mailbox(self, local, password, quota):
        """Call only after the durable service mutation reservation."""
        mailbox_name(local)
        if (local==self.account.lower() or not isinstance(password,str)
                or not 16<=len(password)<=128 or any(ord(c)<33 or ord(c)>126 for c in password)
                or type(quota) is not int or not 1<=quota<=1000000):
            raise ResourceRefused("Invalid mailbox creation fields.")
        if self.adapter=="directadmin":
            result=_form(self._request("POST","/CMD_API_POP",{
                "action":"create","domain":self.domain,"user":local,
                "passwd":password,"passwd2":password,"quota":str(quota)}))
            if result.get("error")!=["0"]:
                raise ResourceRefused("Mailbox acknowledgement uncertain.")
        else:
            self._whm("POST","Email","add_pop",{
                "email":local,"domain":self.domain,"password":password,"quota":str(quota)})


    def mailbox_capacity(self):
        """Read live account-wide counts, not just the primary-domain list."""
        if self.adapter=="directadmin":
            cfg=_form(self._request("GET","/CMD_API_SHOW_USER_CONFIG",{"user":self.account},reseller=True))
            used=_form(self._request("GET","/CMD_API_SHOW_USER_USAGE",{"user":self.account},reseller=True))
            if cfg.get("username")!=[self.account] or cfg.get("domain")!=[self.domain]:
                raise ResourceRefused("Unexpected hosting account.")
            if any(len(v)!=1 for v in cfg.values()) or any(len(v)!=1 for v in used.values()):
                raise ResourceRefused("Ambiguous account usage.")
            count=_count(used.get("nemails",[None])[0])
            limit=_count(cfg.get("nemails",[None])[0],unlimited=True)
            disk=_count(cfg.get("quota",[None])[0],unlimited=True)
        else:
            stats=self._whm("GET","StatsBar","get_stats",{"display":"emailaccounts|diskusage"})
            if not isinstance(stats,list) or len(stats)!=2 or not all(isinstance(x,dict) for x in stats):
                raise ResourceRefused("Invalid account capacity.")
            entries={x.get("id"):x for x in stats}
            if set(entries)!={"emailaccounts","diskusage"}:
                raise ResourceRefused("Invalid account capacity.")
            mail=entries["emailaccounts"]
            count=_count(mail.get("_count"))
            limit=_count(mail.get("_max"),unlimited=True)
            # Accept explicit normalized MB only; unknown units are not
            # treated as an unlimited storage allowance.
            diskrow=entries["diskusage"]
            if diskrow.get("_max")=="unlimited":
                disk=None
            elif diskrow.get("units")=="MB":
                disk=_count(diskrow.get("_max"))
            else:
                raise ResourceRefused("Account storage units unconfirmed.")
        return count,limit,disk
