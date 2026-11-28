"""Fixed-origin Resend transport; verified domain and receipt, no blind retry."""
import hashlib
import json
import re
from uuid import UUID
import requests
from .brevo_transport import DOMAIN,SenderRefused
from .mail_dispatch import DeliveryResult

def _request(method,path,key,*,payload=None,event=None):
    if not isinstance(key,str) or not re.fullmatch(r"re_[A-Za-z0-9_-]{12,200}",key):
        raise SenderRefused("Invalid Resend credential.")
    if (method,path) not in (("GET","/domains"),("POST","/emails")):
        raise SenderRefused("Unapproved mail operation.")
    session=requests.Session()
    session.trust_env=False
    session.headers.clear()
    try:
        headers={"Authorization":"Bearer "+key,"Accept":"application/json"}
        if method=="POST":
            headers["Idempotency-Key"]=event
        with session.request(method,"https://api.resend.com"+path,headers=headers,json=payload,
                timeout=(3,8),verify=True,allow_redirects=False,stream=True) as response:
            if 300<=response.status_code<400:
                raise SenderRefused("Unexpected redirect.")
            buf=bytearray()
            for chunk in response.iter_content(chunk_size=4096):
                buf.extend(chunk)
                if len(buf)>131072:
                    raise SenderRefused("Oversized mail response.")
            body=json.loads(bytes(buf).decode("utf-8"))
            if not isinstance(body,dict):
                raise SenderRefused("Invalid mail response.")
            return response.status_code,body
    except (requests.RequestException,ValueError,UnicodeError):
        raise SenderRefused("Mail supplier unavailable.") from None
    finally:
        session.close()

def verify_domain(domain,key,*,request=None):
    if not isinstance(domain,str) or not DOMAIN.fullmatch(domain):
        raise SenderRefused("Invalid sending domain.")
    status,body=(request or _request)("GET","/domains",key)
    rows=body.get("data")
    if status!=200 or not isinstance(rows,list) or len(rows)>100 or body.get("has_more") is True:
        raise SenderRefused("Bounded domain inventory unavailable.")
    matches=[row for row in rows if isinstance(row,dict) and row.get("name")==domain]
    if len(matches)!=1 or matches[0].get("status")!="verified":
        raise SenderRefused("Sending domain is not verified.")
    return True

def verify_sender(domain,sender,key,*,request=None):
    if not isinstance(sender,str) or sender.rpartition("@")[2].lower()!=domain:
        raise SenderRefused("Sender must belong to the approved domain.")
    return verify_domain(domain,key,request=request)

def send_message(*,key,sender,sender_name,reply_to,recipient,subject,body_text,body_html,idempotency_key,request=None):
    event=hashlib.sha256(("octalve-mail-v1:"+idempotency_key).encode()).hexdigest()
    payload={"from":f"{sender_name} <{sender}>","to":[recipient],"reply_to":reply_to,
             "subject":subject,"text":body_text,"html":body_html}
    try:
        status,body=(request or _request)("POST","/emails",key,payload=payload,event=event)
    except SenderRefused:
        return DeliveryResult("unknown",error_code="supplier_transport_uncertain")
    receipt=body.get("id")
    if status in (200,201) and isinstance(receipt,str):
        try:
            if str(UUID(receipt))==receipt:
                return DeliveryResult("accepted",receipt=receipt)
        except ValueError:
            pass
    if status in (401,403) and not receipt:
        return DeliveryResult("refused",error_code="supplier_authorization_refused")
    return DeliveryResult("unknown",error_code="supplier_acceptance_unconfirmed")
