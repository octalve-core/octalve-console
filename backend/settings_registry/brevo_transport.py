"""Fixed-origin Brevo transactional email transport.

Only the reviewed readback and single-recipient send operations are admitted.
A successful API receipt is acceptance, not inbox delivery.
"""
import hashlib
import json
import re
from urllib.parse import quote
import requests
from .mail_dispatch import DeliveryResult

ORIGIN = "https://api.brevo.com/v3"
DOMAIN = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\Z")


class SenderRefused(ValueError):
    pass


def _request(method, path, key, *, payload=None, session_factory=None):
    if (not isinstance(key, str) or not 12 <= len(key) <= 4096
            or any(ord(c) < 33 or ord(c) > 126 for c in key)):
        raise SenderRefused("Invalid mail credential.")
    if not ((method == "GET" and (path == "/senders" or
            (path.startswith("/senders/domains/") and DOMAIN.fullmatch(path[17:]))))
            or (method == "POST" and path == "/smtp/email" and isinstance(payload, dict))):
        raise SenderRefused("Unapproved mail operation.")
    session = (session_factory or requests.Session)()
    session.trust_env = False
    session.headers.clear()
    try:
        kwargs = {"headers":{"api-key":key,"Accept":"application/json"},
                  "verify":True,"allow_redirects":False,"stream":True,"timeout":(3,8)}
        if method == "POST":
            kwargs["json"] = payload
        with session.request(method, ORIGIN + path, **kwargs) as response:
            if 300 <= response.status_code < 400:
                raise SenderRefused("Unexpected supplier redirect.")
            buf=bytearray()
            for chunk in response.iter_content(chunk_size=4096):
                buf.extend(chunk)
                if len(buf) > 131072:
                    raise SenderRefused("Oversized mail response.")
            try:
                body=json.loads(bytes(buf).decode("utf-8"))
            except (ValueError, UnicodeError):
                raise SenderRefused("Malformed mail response.") from None
            if not isinstance(body, dict):
                raise SenderRefused("Invalid mail response.")
            return response.status_code,body
    except requests.RequestException:
        raise SenderRefused("Mail supplier transport unavailable.") from None
    finally:
        session.close()


def verify_sender(domain, sender, key, *, request=None):
    """Both the exact authenticated domain and an active sender are required."""
    if not isinstance(domain,str) or not DOMAIN.fullmatch(domain) or len(domain)>220:
        raise SenderRefused("Invalid sending domain.")
    if not isinstance(sender,str) or sender.rpartition("@")[2].lower()!=domain:
        raise SenderRefused("Sender must belong to the approved sending domain.")
    call=request or _request
    status,body=call("GET","/senders/domains/"+quote(domain,safe="."),key)
    if (status!=200 or body.get("domain")!=domain or body.get("verified") is not True
            or body.get("authenticated") is not True):
        raise SenderRefused("Sending domain is not independently authenticated.")
    status,body=call("GET","/senders",key)
    rows=body.get("senders")
    if status!=200 or not isinstance(rows,list) or len(rows)>1000:
        raise SenderRefused("Sender inventory unavailable.")
    matched=[item for item in rows if isinstance(item,dict) and item.get("email")==sender]
    if len(matched)!=1 or matched[0].get("active") is not True:
        raise SenderRefused("Exact sender is not active.")
    return True


def send_message(*,key,sender,sender_name,reply_to,recipient,subject,
                 body_text,body_html,idempotency_key,request=None):
    """No repeat or fallback on a potentially accepted or ambiguous response."""
    event=hashlib.sha256(("octalve-mail-v1:"+idempotency_key).encode()).hexdigest()
    payload={"sender":{"email":sender,"name":sender_name},"to":[{"email":recipient}],
             "replyTo":{"email":reply_to},"subject":subject,
             "textContent":body_text,"htmlContent":body_html,
             "headers":{"IdempotencyKey":event}}
    try:
        status,body=(request or _request)("POST","/smtp/email",key,payload=payload)
    except SenderRefused:
        return DeliveryResult("unknown",error_code="supplier_transport_uncertain")
    receipt=body.get("messageId")
    if (status==201 and isinstance(receipt,str) and 1<=len(receipt)<=255
            and all(33<=ord(ch)<=126 for ch in receipt)):
        return DeliveryResult("accepted",receipt=receipt)
    # Authentication/permission denial cannot have accepted the send.
    # Do not classify other 4xx, duplicate idempotency keys, 5xx or
    # malformed success as safely retryable.
    if status in (401,403) and not receipt:
        return DeliveryResult("refused",error_code="supplier_authorization_refused")
    return DeliveryResult("unknown",error_code="supplier_acceptance_unconfirmed")
