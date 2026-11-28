"""Fixed, account-scoped resource protocol; no generic browser-controlled proxy.

Vendor write acknowledgement is never a success receipt. The service authority
must reserve a mutation and independently read back the resource.
"""
import base64
import json
import re
from django.views.decorators.debug import sensitive_variables
from urllib.parse import parse_qs, urlencode

import certifi
import urllib3
from providers.pinned_egress import approved_origin, SupplierReadResponse, SupplierEgressDenied

ACCOUNT = re.compile(r"[A-Za-z][A-Za-z0-9_-]{1,31}\Z")
LOCAL = re.compile(r"[a-z0-9][a-z0-9._-]{0,63}\Z")
LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")


DB_GRANTS={"select":"SELECT","insert":"INSERT","update":"UPDATE","delete":"DELETE","create":"CREATE","drop":"DROP","alter":"ALTER","index":"INDEX","reference":"REFERENCES","tmp_table":"CREATE TEMPORARY TABLES","lock_table":"LOCK TABLES","grant":"GRANT OPTION"}
DB_PROFILES={"read_only":("SELECT",),"read_write":("SELECT","INSERT","UPDATE","DELETE"),"application":tuple(v for k,v in DB_GRANTS.items() if k!="grant")}


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


def subdomain_label(value):
    if not isinstance(value,str) or not LABEL.fullmatch(value) or value in {"www","mail","webmail","cpanel","whm","ftp","autodiscover","autoconfig","ns1","ns2","localhost"}:
        raise ResourceRefused("Invalid or reserved subdomain.")
    return value


def database_suffix(value):
    # Conservative portable identifier; provider prefix is always server-owned.
    if not isinstance(value,str) or not re.fullmatch(r"[a-z][a-z0-9]{0,23}",value):
        raise ResourceRefused("Invalid database identifier.")
    return value


def strong_password(value):
    if not isinstance(value,str) or not 16<=len(value)<=128 or any(ord(ch)<33 or ord(ch)>126 for ch in value):
        raise ResourceRefused("Invalid password.")
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


def _unique_json(response):
    def pairs(items):
        value={}
        for key,item in items:
            if key in value:
                raise ValueError("Duplicate supplier JSON field.")
            value[key]=item
        return value
    return json.loads(response.content,object_pairs_hook=pairs)


def _uapi(response, module, function):
    if response.status_code != 200 or len(response.content) > 200000:
        raise ResourceRefused("Supplier response unavailable.")
    try:
        body = _unique_json(response)
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
    @sensitive_variables("key")
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

    @sensitive_variables("fields")
    def _check_request(self, method, path, fields, reseller):
        """Deny undeclared operations even if a future caller misuses transport."""
        if not isinstance(fields, dict) or any(not isinstance(v,str) for v in fields.values()):
            raise ResourceRefused("Invalid supplier request.")
        if self.adapter == "directadmin":
            if reseller:
                valid = (method == "GET" and path in ("/CMD_API_SHOW_USER_CONFIG", "/CMD_API_SHOW_USER_USAGE") and fields == {"user": self.account})
                if method=="POST" and path=="/CMD_API_USER_PASSWD":
                    valid=(set(fields)=={"username","passwd","passwd2"} and fields["username"]==self.account
                           and strong_password(fields["passwd"]) and fields["passwd"]==fields["passwd2"])
                if method=="POST" and path=="/CMD_API_VERIFY_PASSWORD":
                    valid=(set(fields)=={"user","passwd"} and fields["user"]==self.account
                           and strong_password(fields["passwd"]))
            elif path == "/CMD_API_POP":
                valid = ((method == "GET" and fields == {"action":"full_list","domain":self.domain,"json":"yes"}) or
                         (method == "POST" and set(fields)=={"action","domain","user","passwd","passwd2","quota"} and fields["action"]=="create" and fields["domain"]==self.domain and fields["passwd"]==fields["passwd2"]) or
                         (method == "POST" and fields.get("domain")==self.domain and fields.get("action")=="delete" and set(fields)=={"action","domain","user"}) or
                         (method == "POST" and fields.get("domain")==self.domain and fields.get("action")=="modify" and set(fields) in ({"action","domain","user","quota"},{"action","domain","user","quota","passwd","passwd2"}) and ("passwd" not in fields or fields["passwd"]==fields["passwd2"])))
            elif path=="/CMD_API_DATABASES":
                valid=(method=="GET" and fields=={}) or (method=="POST" and (
                    (set(fields)=={"action","name","user","passwd","passwd2"} and fields["action"]=="create"
                     and database_suffix(fields["name"]) and database_suffix(fields["user"])
                     and strong_password(fields["passwd"]) and fields["passwd"]==fields["passwd2"]) or
                    (set(fields)=={"action","select0"} and fields["action"]=="delete" and self._db_identity(fields["select0"]))))
            elif path=="/CMD_API_DB_USER":
                valid=(method=="GET" and (fields=={"action":"all_users"} or
                    (set(fields)=={"name"} and self._db_identity(fields["name"]))))
                if method=="POST" and fields.get("action")=="create":
                    valid=(set(fields)=={"action","name","user","passwd","passwd2"}
                           and self._db_identity(fields["name"]) and database_suffix(fields["user"])
                           and strong_password(fields["passwd"]) and fields["passwd"]==fields["passwd2"])
                if method=="POST" and fields.get("action")=="delete":
                    valid=(set(fields)=={"action","name","select0"} and self._db_identity(fields["name"])
                           and self._db_identity(fields["select0"]))
            elif path=="/CMD_API_DB_USER_PRIVS":
                if method=="GET":
                    valid=(set(fields)=={"DOMAIN","name","user"} and fields["DOMAIN"]==self.domain
                           and self._db_identity(fields["name"]) and self._db_identity(fields["user"]))
                elif method=="POST":
                    valid=(set(fields)=={"action","domain","name","user"}|set(DB_GRANTS)
                           and fields["action"]=="save" and fields["domain"]==self.domain
                           and self._db_identity(fields["name"]) and self._db_identity(fields["user"])
                           and fields["grant"]=="N" and all(fields[k] in ("Y","N") for k in DB_GRANTS))
            elif path=="/CMD_API_EMAIL_AUTH":
                valid=method=="POST" and set(fields)=={"email","passwd"} and fields["email"].endswith("@"+self.domain)
                if valid:
                    mailbox_name(fields["email"].split("@")[0])
            else:
                valid = path=="/CMD_API_SUBDOMAINS" and (
                    (method=="GET" and fields=={"domain":self.domain}) or
                    (method=="POST" and fields.get("domain")==self.domain and (
                        (fields.get("action")=="create" and set(fields)=={"domain","action","subdomain"}) or
                        (fields.get("action")=="delete" and set(fields)=={"domain","action","select0","contents"} and fields["contents"]=="no"))))
        else:
            common={"api.version","cpanel.user","cpanel.module","cpanel.function"}
            valid=False
            if reseller and method=="POST" and path=="/json-api/passwd":
                valid=(set(fields)=={"api.version","user","password"} and fields["api.version"]=="1"
                       and fields["user"]==self.account and strong_password(fields["password"]))
            if not reseller and path=="/json-api/cpanel":
                base={"cpanel_jsonapi_user":self.account,"cpanel_jsonapi_apiversion":"2","cpanel_jsonapi_module":"SubDomain"}
                func=fields.get("cpanel_jsonapi_func")
                if func=="listsubdomains":
                    valid=method=="GET" and fields=={**base,"cpanel_jsonapi_func":func}
                elif func=="delsubdomain":
                    target=fields.get("domain","")
                    suffix="."+self.domain
                    valid=(method=="POST" and target.endswith(suffix)
                           and fields=={**base,"cpanel_jsonapi_func":func,"domain":target}
                           and subdomain_label(target[:-len(suffix)]))
            if not reseller and path=="/json-api/uapi_cpanel" and fields.get("api.version")=="1" and fields.get("cpanel.user")==self.account:
                op=(method,fields.get("cpanel.module"),fields.get("cpanel.function"))
                allowed={("GET","Email","list_pops_with_disk"):{"domain","no_validate"},
                         ("GET","DomainInfo","list_domains"):set(),
                         ("POST","SubDomain","addsubdomain"):{"domain","rootdomain","dir","disallowdot"},
                         ("GET","Mysql","list_databases"):set(),
                         ("POST","Mysql","create_database"):{"name"},
                         ("POST","Mysql","delete_database"):{"name"},
                         ("GET","Mysql","list_users"):set(),
                         ("POST","Mysql","create_user"):{"name","password"},
                         ("POST","Mysql","delete_user"):{"name"},
                         ("GET","Mysql","get_privileges_on_database"):{"database","user"},
                         ("POST","Mysql","set_privileges_on_database"):{"database","user","privileges"},
                         ("POST","Email","add_pop"):{"email","domain","password","quota"},
                         ("POST","Email","delete_pop"):{"email","domain"},
                         ("POST","Email","edit_pop_quota"):{"email","domain","quota"},
                         ("POST","Email","passwd_pop"):{"email","password"},
                         ("POST","Email","verify_password"):{"email","password"},
                         ("GET","StatsBar","get_stats"):{"display"}}
                valid=op in allowed and set(fields)==common|allowed[op]
                if valid and fields.get("cpanel.module")=="Mysql":
                    for key in ("name","database","user"):
                        if key in fields:
                            self._db_identity(fields[key])
                    if "password" in fields:
                        strong_password(fields["password"])
                    if "privileges" in fields:
                        valid=fields["privileges"] in {",".join(v) for v in DB_PROFILES.values()}
                if op==("POST","SubDomain","addsubdomain") and valid:
                    label=subdomain_label(fields["domain"])
                    valid=fields["rootdomain"]==self.domain and fields["dir"]=="/public_html/"+label and fields["disallowdot"]=="1"
                elif "domain" in fields:
                    valid=valid and fields["domain"]==self.domain
                if "no_validate" in fields:
                    valid=valid and fields["no_validate"]=="0"
                if "display" in fields:
                    valid=valid and fields["display"] in ("emailaccounts|diskusage","sqldatabases","subdomains")
        if valid and method=="POST":
            target=fields.get("user",fields.get("email")) if path not in ("/CMD_API_DATABASES","/CMD_API_VERIFY_PASSWORD","/json-api/passwd","/CMD_API_DB_USER","/CMD_API_DB_USER_PRIVS") and fields.get("cpanel.module")!="Mysql" else None
            if target is not None:
                if (path=="/CMD_API_EMAIL_AUTH" or fields.get("cpanel.function") in ("passwd_pop","verify_password")) and "@" not in target:
                    raise ResourceRefused("Full mailbox identity is required.")
                if "@" in target:
                    local,sep,domain=target.partition("@")
                    if not sep or domain!=self.domain or (path!="/CMD_API_EMAIL_AUTH" and fields.get("cpanel.function") not in ("passwd_pop","verify_password")):
                        raise ResourceRefused("Unexpected mailbox target.")
                    target=local
                mailbox_name(target)
                if target==self.account.lower():
                    raise ResourceRefused("Reserved account name.")
            if path=="/CMD_API_SUBDOMAINS":
                subdomain_label(fields.get("subdomain",fields.get("select0")))
        if not valid:
            raise ResourceRefused("Supplier operation not allowed.")

    @sensitive_variables("fields","headers","args","data","response")
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

    @sensitive_variables("fields","response")
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
                fields=_unique_json(response)
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
        return sorted(_list_names(names))

    @sensitive_variables("password","result")
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


    def delete_mailbox(self, local):
        mailbox_name(local)
        if local==self.account.lower():
            raise ResourceRefused("Reserved account name.")
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_POP",{"action":"delete","domain":self.domain,"user":local})
        else:
            self._whm("POST","Email","delete_pop",{"email":local,"domain":self.domain})

    def change_mailbox_quota(self, local, quota):
        mailbox_name(local)
        if local==self.account.lower() or type(quota) is not int or not 1<=quota<=1000000:
            raise ResourceRefused("Invalid mailbox quota.")
        if self.adapter=="directadmin":
            # Modify uses bytes or explicit units, unlike create (MB).
            self._da_ack("/CMD_API_POP",{"action":"modify","domain":self.domain,
                                       "user":local,"quota":str(quota)+"MB"})
        else:
            self._whm("POST","Email","edit_pop_quota",{"email":local,"domain":self.domain,"quota":str(quota)})

    def _da_ack(self,path,fields):
        if _form(self._request("POST",path,fields)).get("error")!=["0"]:
            raise ResourceRefused("Supplier acknowledgement uncertain.")

    def _subdomain_api2(self, method, func, fields):
        # cPanel documents no UAPI equivalent for removal. Restrict the
        # legacy bridge to these two operations; never accept a generic call.
        response=self._request(method,"/json-api/cpanel",{
            "cpanel_jsonapi_user":self.account,"cpanel_jsonapi_apiversion":"2",
            "cpanel_jsonapi_module":"SubDomain","cpanel_jsonapi_func":func,**fields})
        try:
            if response.status_code!=200:
                raise ValueError()
            result=_unique_json(response)["cpanelresult"]
            rows=result["data"]
            if (str(result["apiversion"])!="2" or result["func"]!=func
                    or result["module"]!="SubDomain" or str(result["event"]["result"])!="1"
                    or result.get("error") or not isinstance(rows,list) or len(rows)>2000
                    or any(not isinstance(row,dict) or ("result" in row and str(row["result"])!="1") for row in rows)):
                raise ValueError()
            return rows
        except (ValueError,KeyError,TypeError,AttributeError):
            raise ResourceRefused("Subdomain operation not confirmed.") from None

    def create_subdomain(self, label):
        subdomain_label(label)
        domain_name(label+"."+self.domain)
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_SUBDOMAINS",{"domain":self.domain,"action":"create","subdomain":label})
        else:
            self._whm("POST","SubDomain","addsubdomain",{"domain":label,"rootdomain":self.domain,
                       "dir":"/public_html/"+label,"disallowdot":"1"})

    def subdomain_created(self, target):
        if target not in self.subdomains():
            return False
        if self.adapter=="directadmin":
            return True
        suffix="."+self.domain
        if not target.endswith(suffix):
            return False
        label=subdomain_label(target[:-len(suffix)])
        rows=self._subdomain_api2("GET","listsubdomains",{})
        matches=[row for row in rows if row.get("domain")==target]
        return (len(matches)==1 and matches[0].get("rootdomain")==self.domain
                and matches[0].get("subdomain")==label
                and matches[0].get("basedir")=="public_html/"+label)

    def delete_subdomain(self, label):
        subdomain_label(label)
        # Removing hosting configuration must not remove website files.
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_SUBDOMAINS",{"domain":self.domain,"action":"delete","select0":label,"contents":"no"})
        else:
            target=label+"."+self.domain
            # Avoid removing addon-domain backing subdomains or custom roots.
            if not self.subdomain_created(target):
                raise ResourceRefused("Subdomain document root not confirmed.")
            rows=self._subdomain_api2("POST","delsubdomain",{"domain":target})
            if len(rows)!=1 or str(rows[0].get("result"))!="1":
                raise ResourceRefused("Subdomain removal not acknowledged.")

    def subdomain_capacity(self):
        if self.adapter=="cpanel-whm":
            rows=self._whm("GET","StatsBar","get_stats",{"display":"subdomains"})
            if not isinstance(rows,list) or len(rows)!=1 or not isinstance(rows[0],dict) or rows[0].get("id")!="subdomains":
                raise ResourceRefused("Invalid subdomain capacity.")
            item=rows[0]
            maximum=_count(item.get("_max"),unlimited=True)
            if maximum==0 and item.get("zeroisunlimited") in (1,"1"):
                maximum=None
            return _count(item.get("_count")),maximum
        cfg=_form(self._request("GET","/CMD_API_SHOW_USER_CONFIG",{"user":self.account},reseller=True))
        used=_form(self._request("GET","/CMD_API_SHOW_USER_USAGE",{"user":self.account},reseller=True))
        if cfg.get("username")!=[self.account] or cfg.get("domain")!=[self.domain]:
            raise ResourceRefused("Unexpected hosting account.")
        if any(len(v)!=1 for v in cfg.values()) or any(len(v)!=1 for v in used.values()):
            raise ResourceRefused("Ambiguous account usage.")
        return _count(used.get("nsubdomains",[None])[0]),_count(cfg.get("nsubdomains",[None])[0],unlimited=True)


    @sensitive_variables("password")
    def change_mailbox_password(self, local, password, quota):
        mailbox_name(local)
        if (local==self.account.lower() or not isinstance(password,str)
                or not 16<=len(password)<=128 or any(ord(c)<33 or ord(c)>126 for c in password)
                or (quota is not None and (type(quota) is not int or not 1<=quota<=1000000))):
            raise ResourceRefused("Invalid mailbox password change.")
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_POP",{"action":"modify","domain":self.domain,
                "user":local,"quota":"0" if quota is None else str(quota)+"MB",
                "passwd":password,"passwd2":password})
        else:
            self._whm("POST","Email","passwd_pop",{"email":local+"@"+self.domain,"password":password})

    @sensitive_variables("password","result")
    def verify_mailbox_password(self, local, password):
        mailbox_name(local)
        if (local==self.account.lower() or not isinstance(password,str)
                or not 16<=len(password)<=128 or any(ord(c)<33 or ord(c)>126 for c in password)):
            raise ResourceRefused("Invalid mailbox verification.")
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_EMAIL_AUTH",{"email":local+"@"+self.domain,"passwd":password})
            return True
        result=self._whm("POST","Email","verify_password",{"email":local+"@"+self.domain,"password":password})
        return type(result) in (int,str) and str(result)=="1"


    def databases(self):
        """Account-owned prefixed databases; no grants or credentials returned."""
        if self.adapter=="directadmin":
            names=_legacy_list(self._request("GET","/CMD_API_DATABASES",{}))
        else:
            data=self._whm("GET","Mysql","list_databases",{})
            if not isinstance(data,list) or len(data)>2000 or any(not isinstance(item,dict) for item in data):
                raise ResourceRefused("Invalid database inventory.")
            names=_list_names([item.get("database") for item in data])
        # Require explicit account prefix, even where the supplier permits
        # unprefixed database names. Never guess ownership of those names.
        if any(not name.startswith(self.account+"_") or not re.fullmatch(r"[A-Za-z0-9_]{1,64}",name)
               or len(name)<=len(self.account)+1 for name in names):
            raise ResourceRefused("Database account prefix is not confirmed.")
        return sorted(names)


    def _db_identity(self, value):
        if (not isinstance(value,str) or not value.startswith(self.account+"_")
                or not re.fullmatch(r"[A-Za-z0-9_]{1,64}",value)
                or len(value)<=len(self.account)+1):
            raise ResourceRefused("Database account prefix is not confirmed.")
        return value

    def database_name(self, local):
        return self._db_identity(self.account+"_"+database_suffix(local))

    def database_capacity(self):
        if self.adapter=="directadmin":
            cfg=_form(self._request("GET","/CMD_API_SHOW_USER_CONFIG",{"user":self.account},reseller=True))
            used=_form(self._request("GET","/CMD_API_SHOW_USER_USAGE",{"user":self.account},reseller=True))
            if cfg.get("username")!=[self.account] or cfg.get("domain")!=[self.domain]:
                raise ResourceRefused("Unexpected hosting account.")
            if any(len(v)!=1 for v in cfg.values()) or any(len(v)!=1 for v in used.values()):
                raise ResourceRefused("Ambiguous database capacity.")
            return _count(used.get("mysql",[None])[0]),_count(cfg.get("mysql",[None])[0],unlimited=True)
        stats=self._whm("GET","StatsBar","get_stats",{"display":"sqldatabases"})
        if not isinstance(stats,list) or len(stats)!=1 or not isinstance(stats[0],dict) or stats[0].get("id")!="sqldatabases":
            raise ResourceRefused("Invalid database capacity.")
        item=stats[0]
        maximum=_count(item.get("_max"),unlimited=True)
        if maximum==0 and item.get("zeroisunlimited") in (1,"1"):
            maximum=None
        return _count(item.get("_count")),maximum

    def database_users(self, name):
        """Database membership readback, not a password confirmation."""
        name=self._db_identity(name)
        if self.adapter=="directadmin":
            names=_legacy_list(self._request("GET","/CMD_API_DB_USER",{"name":name}))
        else:
            data=self._whm("GET","Mysql","list_databases",{})
            if not isinstance(data,list) or len(data)>2000 or any(not isinstance(x,dict) for x in data):
                raise ResourceRefused("Invalid database inventory.")
            matches=[item for item in data if item.get("database")==name]
            if len(matches)!=1:
                raise ResourceRefused("Database not independently identified.")
            names=_list_names(matches[0].get("users"))
        return sorted(self._db_identity(x) for x in names if x!=self.account)

    @sensitive_variables("password")
    def create_database(self, local, *, initial_user=None, password=None):
        name=self.database_name(local)
        if self.adapter=="directadmin":
            # DA creates a database and its initial user in one vendor operation.
            database_suffix(initial_user)
            strong_password(password)
            self._da_ack("/CMD_API_DATABASES",{"action":"create","name":local,
                "user":initial_user,"passwd":password,"passwd2":password})
        else:
            if initial_user is not None or password is not None:
                raise ResourceRefused("Create cPanel database users separately.")
            self._whm("POST","Mysql","create_database",{"name":name})

    def delete_database(self, name):
        name=self._db_identity(name)
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_DATABASES",{"action":"delete","select0":name})
        else:
            self._whm("POST","Mysql","delete_database",{"name":name})


    @sensitive_variables("password")
    def reset_hosting_password(self,password):
        strong_password(password)
        if self.adapter=="directadmin":
            result=_form(self._request("POST","/CMD_API_USER_PASSWD",{
                "username":self.account,"passwd":password,"passwd2":password},reseller=True))
            if result.get("error")!=["0"]:
                raise ResourceRefused("Hosting password mutation not acknowledged.")
        else:
            response=self._request("POST","/json-api/passwd",{
                "api.version":"1","user":self.account,"password":password},reseller=True)
            try:
                result=_unique_json(response)["metadata"]
                if response.status_code!=200 or result["command"]!="passwd" or str(result["result"])!="1":
                    raise ValueError()
            except (ValueError,KeyError,TypeError):
                raise ResourceRefused("Hosting password mutation not acknowledged.") from None

    @sensitive_variables("password","headers","response","body")
    def verify_hosting_password(self,password):
        strong_password(password)
        if self.adapter=="directadmin":
            result=_form(self._request("POST","/CMD_API_VERIFY_PASSWORD",
                        {"user":self.account,"passwd":password},reseller=True))
            return result.get("valid")==["1"] and result.get("error",["0"])==["0"]
        # Only the assigned account's new credential, not the reseller token,
        # is used for the independent fixed cPanel TLS endpoint.
        host,port,ip,path=approved_origin(self.origin+"/json-api/passwd",bound_origin=self.binding)
        if port not in (443,2087) or path!="/json-api/passwd":
            raise ResourceRefused("Unexpected hosting endpoint.")
        pool=urllib3.HTTPSConnectionPool(host=ip,port=2083,server_hostname=host,
            assert_hostname=host,cert_reqs="CERT_REQUIRED",ca_certs=certifi.where(),
            timeout=urllib3.Timeout(connect=3,read=6),retries=False,maxsize=1,block=True)
        headers={"Authorization":"Basic "+base64.b64encode((self.account+":"+password).encode()).decode(),
                 "Host":host+":2083","Accept":"application/json"}
        try:
            response=pool.request("GET","/execute/DomainInfo/list_domains",headers=headers,
                                  redirect=False,retries=False,preload_content=False)
            try:
                if response.status!=200 or int(response.headers.get("content-length","0"))>200000:
                    return False
                body=response.read(200001)
                if len(body)>200000:
                    return False
                data=_unique_json(SupplierReadResponse(response.status,body))
                result=data["result"]
                return (str(data["apiversion"])=="3" and data["module"]=="DomainInfo"
                        and data["func"]=="list_domains" and str(result["status"])=="1"
                        and not result.get("errors") and result["data"]["main_domain"]==self.domain)
            finally:
                response.close()
                response.release_conn()
        except (urllib3.exceptions.HTTPError,ValueError,OSError,KeyError,TypeError,AttributeError):
            return False
        finally:
            pool.close()


    def all_database_users(self):
        if self.adapter=="directadmin":
            response=self._request("GET","/CMD_API_DB_USER",{"action":"all_users"})
            # DA documents a URL-encoded map (full name -> local suffix).
            # Empty body is accepted only on HTTP 200 for this exact inventory,
            # and database memberships are also checked before creation.
            if response.status_code==200 and response.content==b"":
                return []
            fields=_form(response)
            names=[]
            for name,values in fields.items():
                if name=="error" and values==["0"]:
                    continue
                self._db_identity(name)
                if values!=[name[len(self.account)+1:]]:
                    raise ResourceRefused("Unexpected database-user identity.")
                names.append(name)
            return sorted(_list_names(names))
        rows=self._whm("GET","Mysql","list_users",{})
        if not isinstance(rows,list) or len(rows)>2000 or any(not isinstance(row,dict) for row in rows):
            raise ResourceRefused("Invalid database-user inventory.")
        return sorted(self._db_identity(name) for name in _list_names([row.get("user") for row in rows]) if name!=self.account)

    def user_exists(self,user):
        user=self._db_identity(user)
        if user in self.all_database_users():
            return True
        if self.adapter=="directadmin":
            # Avoid reusing an existing user and resetting its password.
            databases=self.databases()
            if len(databases)>25:
                raise ResourceRefused("Database membership inventory exceeds bounded inspection.")
            return any(user in self.database_users(db) for db in databases)
        return False

    @sensitive_variables("password")
    def create_database_user(self,local,password,database=None):
        user=self.database_name(local)
        strong_password(password)
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_DB_USER",{"action":"create","name":self._db_identity(database),
                       "user":local,"passwd":password,"passwd2":password})
        else:
            if database is not None:
                raise ResourceRefused("Assign database privileges separately.")
            self._whm("POST","Mysql","create_user",{"name":user,"password":password})

    def delete_database_user(self,user,database=None):
        user=self._db_identity(user)
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_DB_USER",{"action":"delete","name":self._db_identity(database),"select0":user})
        else:
            if database is not None:
                raise ResourceRefused("Unexpected database for account-wide deletion.")
            self._whm("POST","Mysql","delete_user",{"name":user})

    def database_grants(self,database,user):
        database,user=self._db_identity(database),self._db_identity(user)
        if self.adapter=="directadmin":
            fields=_form(self._request("GET","/CMD_API_DB_USER_PRIVS",{
                "DOMAIN":self.domain,"name":database,"user":user}))
            if set(fields)-{"error"}!=set(DB_GRANTS) or any(fields[k] not in (["Y"],["N"]) for k in DB_GRANTS):
                raise ResourceRefused("Unrecognized database privilege inventory.")
            return sorted(DB_GRANTS[k] for k in DB_GRANTS if fields[k]==["Y"])
        grants=_list_names(self._whm("GET","Mysql","get_privileges_on_database",{"database":database,"user":user}))
        # Preserve unknown existing grants in readback; they never become a
        # permitted write profile or a successful match.
        return sorted(grants)

    def set_database_grants(self,database,user,profile):
        database,user=self._db_identity(database),self._db_identity(user)
        if profile not in DB_PROFILES:
            raise ResourceRefused("Unsupported database privilege profile.")
        grants=DB_PROFILES[profile]
        if self.adapter=="directadmin":
            self._da_ack("/CMD_API_DB_USER_PRIVS",{"action":"save","domain":self.domain,
                "name":database,"user":user,**{k:"Y" if v in grants else "N" for k,v in DB_GRANTS.items()}})
        else:
            self._whm("POST","Mysql","set_privileges_on_database",{"database":database,"user":user,
                      "privileges":",".join(grants)})
