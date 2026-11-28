"""Fixed origin live registration mutation, separate from read-only transport.

Caller must reserve a paid and approved domain before invoking create.
Only exact domain-specific status/readback paths are accepted.
"""
import json
import requests
from django.views.decorators.debug import sensitive_variables
from .cloudflare_int01 import API_ORIGIN,MAX_REPLY_BYTES,require_id,require_domain,CloudflareINT01Denied,_require_result

def workflow_proof(data,domain,path):
    """Cloudflare's SDK documents context.domain_name; the guide also uses a top-level field."""
    if not isinstance(data,dict):
        raise CloudflareINT01Denied()
    context=data.get("context") or {}
    if not isinstance(context,dict):
        raise CloudflareINT01Denied()
    names=[value for value in (data.get("domain_name"),context.get("domain_name")) if value is not None]
    registration=context.get("registration")
    if registration is not None:
        if not isinstance(registration,dict) or registration.get("domain_name")!=domain:
            raise CloudflareINT01Denied()
        names.append(registration["domain_name"])
    links=data.get("links") or {}
    if not isinstance(links,dict) or (links.get("self") is not None and links["self"]!=path):
        raise CloudflareINT01Denied()
    if not names or any(name!=domain for name in names):
        raise CloudflareINT01Denied()
    state=data.get("state")
    if (state not in ("pending","in_progress","blocked","action_required","failed","succeeded")
        or type(data.get("completed")) is not bool or data["completed"]!=(state in ("failed","succeeded"))):
        raise CloudflareINT01Denied()
    return {"domain_name":domain,"state":state,"completed":data["completed"]}

@sensitive_variables("token","contact")
def request(account,token,domain,operation,contact=None):
    account=require_id(account)
    domain=require_domain(domain)
    path=f"/accounts/{account}/registrar/registrations"
    if operation=="create":
        method="POST"
        if not isinstance(contact,dict) or set(contact)!={"email","phone","postal_info"}:
            raise CloudflareINT01Denied()
        body={"domain_name":domain,"years":1,"auto_renew":False,"privacy_mode":"redaction","contacts":{"registrant":contact}}
    elif operation=="status":
        method="GET"
        path+="/"+domain+"/registration-status"
        body=None
    else:
        raise CloudflareINT01Denied()
    if not isinstance(token,str) or not 20<=len(token)<=512 or any(ord(c)<33 or ord(c)>126 for c in token):
        raise CloudflareINT01Denied()
    with requests.Session() as session:
        session.trust_env=False
        try:
            headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
            if method=="POST":
                headers.update({"Content-Type":"application/json","Prefer":"respond-async"})
            with session.request(method,API_ORIGIN+path,headers=headers,json=body,timeout=(3,8),verify=True,allow_redirects=False,stream=True) as response:
                if response.status_code not in (200,201,202):
                    raise CloudflareINT01Denied()
                raw=bytearray()
                for chunk in response.iter_content(4096):
                    raw.extend(chunk)
                    if len(raw)>MAX_REPLY_BYTES:
                        raise CloudflareINT01Denied()
                data=_require_result(json.loads(raw))
        except (requests.RequestException,ValueError,TypeError):
            raise CloudflareINT01Denied() from None
    return workflow_proof(data,domain,f"/accounts/{account}/registrar/registrations/{domain}/registration-status")
