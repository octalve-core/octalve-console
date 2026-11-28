"""ResellerClub V2 fixed-origin typed transport.

Contract source: official 2.0.0 OpenAPI documents. No caller-supplied URL,
generic proxy, automatic HTTP retry, redirect, or response logging.
Writes are internal only; callers must hold durable application authority.
"""
import json
import re
from datetime import datetime,timezone as utc
from decimal import Decimal,InvalidOperation
import requests
from django.views.decorators.debug import sensitive_variables
from .cloudflare_int01 import require_domain,CloudflareINT01Denied
from .resellerclub_sandbox import ResellerClubUnavailable

ORIGINS={"test":"https://api.sandbox.resellerclub.com/v2","live":"https://api.resellerclub.com/v2"}
DOMAIN_OPTIONS="OrderDetails,StatusDetails,ContactIds,RegistrantContactDetails,NsDetails,DomainStatus"

def ident(value):
    if type(value) not in (str,int) or not re.fullmatch(r"[1-9][0-9]{0,9}",str(value)) or int(value)>2147483647:
        raise ResellerClubUnavailable()
    return str(value)

def nameservers(values):
    if not isinstance(values,list) or not 2<=len(values)<=13:
        raise ResellerClubUnavailable()
    result=[]
    for name in values:
        if (not isinstance(name,str) or name!=name.lower() or len(name)>253 or
            not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}",name)):
            raise ResellerClubUnavailable()
        result.append(name)
    if len(set(result))!=len(result):
        raise ResellerClubUnavailable()
    return result

def epoch(value):
    if type(value) is not int or not 946684800<=value<=7258118400:
        raise ResellerClubUnavailable()
    return datetime.fromtimestamp(value,tz=utc.utc)

def money(value):
    if not isinstance(value,str) or not re.fullmatch(r"[0-9]{1,10}(?:\.[0-9]{1,2})?",value):
        raise ResellerClubUnavailable()
    try:
        amount=Decimal(value).quantize(Decimal(".01"))
    except InvalidOperation:
        raise ResellerClubUnavailable() from None
    if amount<=0:
        raise ResellerClubUnavailable()
    return str(amount)

def secret_code(value):
    if not isinstance(value,str) or not 8<=len(value)<=255 or any(ord(c)<33 or ord(c)>126 for c in value):
        raise ResellerClubUnavailable()
    return value

class ResellerClub:
    @sensitive_variables("api_key")
    def __init__(self,reseller_id,api_key,environment,*,session_factory=None):
        self.reseller_id=ident(reseller_id)
        if (environment not in ORIGINS or not isinstance(api_key,str) or not 12<=len(api_key)<=512
            or any(ord(c)<33 or ord(c)>126 for c in api_key)):
            raise ResellerClubUnavailable()
        self.origin=ORIGINS[environment]
        self._key=api_key
        self._session_factory=session_factory or requests.Session

    @sensitive_variables("body","headers","self","data","raw")
    def _call(self,method,path,*,params=None,body=None,missing=False):
        # This private method is called only by typed methods with validated
        # domain names and IDs. Never expose it as a customer/API generic proxy.
        if (method not in ("GET","POST","PUT") or not re.fullmatch(r"/[a-zA-Z0-9._/-]+",path)
            or ".." in path or "//" in path):
            raise ResellerClubUnavailable()
        session=self._session_factory()
        session.trust_env=False
        session.headers.clear()
        try:
            with session.request(method,self.origin+path,params=params,json=body,
                headers={"Authorization":"ApiKey "+self._key,"X-User-Id":self.reseller_id,"Accept":"application/json"},
                timeout=(3,8),allow_redirects=False,verify=True,stream=True) as response:
                if response.status_code==404 and missing and method=="GET":
                    return None
                if response.status_code not in (200,201,202):
                    raise ResellerClubUnavailable()
                raw=bytearray()
                for chunk in response.iter_content(chunk_size=4096):
                    raw.extend(chunk)
                    if len(raw)>131072:
                        raise ResellerClubUnavailable()
                data=json.loads(raw)
                if not isinstance(data,dict) or str(data.get("status","")).lower() in ("failed","error","failure"):
                    raise ResellerClubUnavailable()
                return data
        except (requests.RequestException,ValueError,TypeError,UnicodeError):
            raise ResellerClubUnavailable() from None
        finally:
            session.close()

    def live_domain_check(self,domain):
        domain=require_domain(domain)
        if domain.count(".")!=1:
            raise ResellerClubUnavailable()
        label,tld=domain.split(".")
        data=self._call("GET","/domains/available",params={"domainName":[label],"tlds":[tld]})
        rows=data.get("domains")
        if not isinstance(rows,list) or len(rows)!=1 or not isinstance(rows[0],dict) or rows[0].get("domainName")!=domain:
            raise ResellerClubUnavailable()
        row=rows[0]
        state=row.get("status")
        if state in ("regthroughothers","regthroughus","unavailable"):
            return {"name":domain,"registrable":False}
        if state not in ("available","Available") or row.get("tmClaimsKey") or row.get("error"):
            raise ResellerClubUnavailable()
        premium=self._call("GET","/domains/premium-check",params={"domainName":domain})
        if premium.get("premium") is not False:
            raise ResellerClubUnavailable()
        costs=row.get("cost")
        if not isinstance(costs,list) or not 2<=len(costs)<=10:
            raise ResellerClubUnavailable()
        mapped={}
        currencies=set()
        for cost in costs:
            if not isinstance(cost,dict) or not isinstance(cost.get("action"),str):
                raise ResellerClubUnavailable()
            action={"create":"registration","add":"registration","register":"registration","registration":"registration",
                "renew":"renewal","renewal":"renewal","transfer":"transfer"}.get(cost["action"].lower())
            if action is None:
                continue
            currency=cost.get("currency")
            if action in mapped or not isinstance(currency,str) or not re.fullmatch(r"[A-Z]{3}",currency):
                raise ResellerClubUnavailable()
            currencies.add(currency)
            mapped[action]=money(cost.get("price"))
        if not {"registration","renewal"}<=set(mapped) or len(currencies)!=1:
            raise ResellerClubUnavailable()
        return {"name":domain,"registrable":True,"tier":"standard","currency":currencies.pop(),
            **{k+"_cost":v for k,v in mapped.items()},"read_only":True,"environment":"live" if self.origin==ORIGINS["live"] else "test"}

    @sensitive_variables("contact","data")
    def customer(self,contact):
        data=self._call("GET","/customers/by-username",params={"username":contact["email"]},missing=True)
        if data is None:
            return None
        row=data.get("customer")
        if (not isinstance(row,dict) or row.get("username")!=contact["email"] or row.get("email")!=contact["email"]
            or ident(row.get("resellerId"))!=self.reseller_id):
            raise ResellerClubUnavailable()
        return ident(row.get("customerId"))

    @sensitive_variables("contact","body","password")
    def create_customer(self,contact,password):
        postal=contact["postal_info"];address=postal["address"];country,phone=contact["phone"][1:].split(".")
        body={"username":contact["email"],"password":password,"name":postal["name"],"company":"Not Applicable",
            "addressLine1":address["street"],"city":address["city"],"state":address["state"],"country":address["country_code"],
            "zipcode":address["postal_code"],"phoneCountryCode":country,"phone":phone,
            "languagePreference":"en","dontSendSignupEmail":True,"acceptPolicy":True,"marketingEmailConsent":False}
        data=self._call("POST","/customers",body=body)
        return ident(data.get("customerId"))

    def contact_payload(self,customer,contact):
        postal=contact["postal_info"];address=postal["address"];country,phone=contact["phone"][1:].split(".")
        return {"customerId":int(ident(customer)),"type":"Contact","name":postal["name"],"email":contact["email"],
            "addressLine1":address["street"],"city":address["city"],"state":address["state"],"country":address["country_code"],
            "zipcode":address["postal_code"],"phoneCountryCode":country,"phone":phone}

    @sensitive_variables("contact","data","expected")
    def find_contact(self,customer,contact):
        expected=self.contact_payload(customer,contact)
        data=self._call("GET","/contacts",params={"customerId":int(ident(customer)),"email":contact["email"],"size":50,"page":1,"type":"Contact"})
        rows=data.get("contacts")
        if (not isinstance(rows,list) or type(data.get("totalItems")) is not int or data["totalItems"]!=len(rows)
            or data.get("itemsOnPage")!=len(rows) or len(rows)>=50 or any(not isinstance(x,dict) for x in rows)):
            raise ResellerClubUnavailable()
        matches=[]
        for row in rows:
            if ident(row.get("customerId"))!=ident(customer):
                raise ResellerClubUnavailable()
            if all(str(row.get(k))==str(v) for k,v in expected.items()) and row.get("currentStatus")=="Active":
                matches.append(ident(row.get("contactId")))
        if len(matches)>1:
            raise ResellerClubUnavailable()
        return matches[0] if matches else None

    @sensitive_variables("contact")
    def create_contact(self,customer,contact):
        return ident(self._call("POST","/contacts",body=self.contact_payload(customer,contact)).get("contactId"))

    @sensitive_variables("data","row")
    def domain_details(self,domain,*,order=None,customer=None,contact=None,missing=False,include_secret=False):
        domain=require_domain(domain)
        path="/domains/"+ident(order) if order is not None else "/domains/by-name/"+domain
        data=self._call("GET",path,params={"options":"All" if include_secret else DOMAIN_OPTIONS},missing=missing)
        if data is None:
            return None
        row=data.get("domain")
        if (not isinstance(row,dict) or row.get("domainName")!=domain or ident(row.get("resellerId"))!=self.reseller_id
            or row.get("isImmediateReseller") is not True):
            raise ResellerClubUnavailable()
        rid,cid,contactid=ident(row.get("orderId")),ident(row.get("customerId")),ident(row.get("registrantContactId"))
        if ((order is not None and rid!=ident(order)) or (customer is not None and cid!=ident(customer))
            or (contact is not None and contactid!=ident(contact))):
            raise ResellerClubUnavailable()
        created=epoch(row.get("creationTime"))
        expires=epoch(row.get("domainEndTime",row.get("expiryDate")))
        if expires<=created:
            raise ResellerClubUnavailable()
        state=row.get("currentStatus")
        if state not in ("Active","InActive","Suspended","Pending Delete Restorable","Deleted","Pending Verification","Failed Verification","Archived"):
            raise ResellerClubUnavailable()
        ns_count=row.get("numberOfNameServers")
        ns=[]
        if ns_count is not None:
            if type(ns_count) is not int or not 0<=ns_count<=13:
                raise ResellerClubUnavailable()
            if ns_count:
                ns=nameservers([row.get("ns"+str(n)) for n in range(1,ns_count+1)])
        raa=row.get("raaVerificationStatus")
        if raa is not None and (not isinstance(raa,str) or not re.fullmatch(r"[A-Za-z0-9 _-]{1,80}",raa)):
            raise ResellerClubUnavailable()
        result={"domain_name":domain,"order_id":rid,"customer_id":cid,"contact_id":contactid,
            "registered_at":created.isoformat(),"expires_at":expires.isoformat(),"status":state,
            "registrant_verification":raa or "unknown","nameservers":ns,
            "auto_renew":row.get("isAutoRenew"),"premium":row.get("isPremium"),"registrant_email":row.get("registrantEmail")}
        if include_secret:
            result["auth_code"]=secret_code(row.get("domainSecret"))
        return result

    def register(self,domain,customer,contact,ns):
        body={"domainName":require_domain(domain),"years":1,"customerId":int(ident(customer)),
            **{key:int(ident(contact)) for key in ("regContactId","adminContactId","techContactId","billingContactId")},
            "ns":nameservers(ns),"invoiceOption":"PayInvoice","autoRenew":False}
        result=self._call("POST","/domains",body=body)
        return ident(result.get("orderId"))

    def renew(self,order,expiry,years=1):
        if type(years) is not int or years not in (1,2,5,10) or type(expiry) is not int:
            raise ResellerClubUnavailable()
        epoch(expiry)
        result=self._call("POST","/domains/"+ident(order)+"/renew",
            body={"years":years,"expDate":expiry,"invoiceOption":"PayInvoice","autoRenew":False})
        if ident(result.get("orderId",result.get("entityId")))!=ident(order):
            raise ResellerClubUnavailable()
        return ident(result.get("eaqId"))

    def change_nameservers(self,order,ns):
        result=self._call("PUT","/domains/"+ident(order)+"/nameservers",body={"ns":nameservers(ns)})
        if ident(result.get("entityId"))!=ident(order):
            raise ResellerClubUnavailable()
        return ident(result.get("eaqId"))

    def resend_verification(self,order):
        return self._call("POST","/domains/"+ident(order)+"/raa-verification/resend-email").get("success") is True

    def transfer_eligibility(self,domain):
        return self._call("GET","/domains/"+require_domain(domain)+"/validate-transfer-in").get("success") is True

    @sensitive_variables("auth_code","body")
    def transfer(self,domain,customer,contact,auth_code,ns):
        body={"authCode":secret_code(auth_code),"customerId":int(ident(customer)),
            **{key:int(ident(contact)) for key in ("regContactId","adminContactId","techContactId","billingContactId")},
            "ns":nameservers(ns),"invoiceOption":"PayInvoice","autoRenew":False}
        result=self._call("POST","/domains/"+require_domain(domain)+"/transfer-in",body=body)
        return ident(result.get("entityId"))
