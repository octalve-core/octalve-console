"""Authenticated encryption for a customer-supplied transfer-in code."""
import json
from cryptography.fernet import InvalidToken
from django.views.decorators.debug import sensitive_variables
from providers.connection_vault import keyring,VaultUnavailable
from providers.resellerclub_live import secret_code

@sensitive_variables("code")
def seal(domain,code):
    kid,keys=keyring()
    payload={"domain":str(domain.public_id),"owner":domain.client_id,"name":domain.domain_name,"item":domain.order_item_id,"code":secret_code(code)}
    return kid+":"+keys[kid].encrypt(json.dumps(payload,separators=(",",":")).encode()).decode()

@sensitive_variables("payload","value")
def open_code(domain):
    try:
        kid,value=domain.epp_code_encrypted.split(":",1)
        _,keys=keyring()
        payload=json.loads(keys[kid].decrypt(value.encode()))
        if any(payload[k]!=v for k,v in {"domain":str(domain.public_id),"owner":domain.client_id,"name":domain.domain_name,"item":domain.order_item_id}.items()):
            raise VaultUnavailable()
        return secret_code(payload["code"])
    except (AttributeError,KeyError,ValueError,TypeError,InvalidToken):
        raise VaultUnavailable() from None
