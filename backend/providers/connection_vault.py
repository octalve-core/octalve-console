"""Only encrypted bytes leave this module. Independent key from legacy Provider."""
import base64
import json
from cryptography.fernet import Fernet
from django.conf import settings
from rest_framework.exceptions import APIException

class VaultUnavailable(APIException):
    status_code=503
    default_detail="Credential storage is unavailable."
    default_code="vault_unavailable"

def vault():
    key=getattr(settings,"CLOUD_PROVIDER_VAULT_KEY","")
    legacy=getattr(settings,"ENCRYPTION_KEY","")
    if not key or key==legacy:
        raise VaultUnavailable()
    try:
        raw=base64.urlsafe_b64decode(key)
        if len(raw)!=32:
            raise ValueError("Invalid key size")
        return Fernet(key.encode("ascii"))
    except (ValueError,TypeError,UnicodeError) as exc:
        raise VaultUnavailable() from exc

def seal(adapter, connection_id, version, secrets):
    # Cryptographically bind ciphertext to its record identity/version.
    payload={"adapter":adapter,"connection_id":str(connection_id),"version":version,"secrets":secrets}
    return vault().encrypt(json.dumps(payload,sort_keys=True,separators=(",",":")).encode()).decode()

def inspect_test_only(ciphertext, adapter, connection_id, version):
    """Tests only. No HTTP route or general-purpose credential-read method."""
    data=json.loads(vault().decrypt(ciphertext.encode()).decode())
    if data["adapter"]!=adapter or data["connection_id"]!=str(connection_id) or data["version"]!=version:
        raise VaultUnavailable()
    return data["secrets"]
