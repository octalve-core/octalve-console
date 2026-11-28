"""Fixed-origin, read-only VPS credential verification, never provisioning.

These endpoints establish access only, not account ownership continuity,
write permission, product eligibility, available credit, or supplier acceptance.
"""
import json
import requests
from django.views.decorators.debug import sensitive_variables
from .connection_verification import ProviderReadbackFailed

_ENDPOINTS = {
    "digitalocean": "https://api.digitalocean.com/v2/account",
    "hetzner": "https://api.hetzner.cloud/v1/servers?per_page=1",
    "vultr": "https://api.vultr.com/v2/account",
}
_MAX_BYTES = 65536


def _valid_response(adapter, body):
    if not isinstance(body, dict):
        return False
    if adapter == "hetzner":
        servers = body.get("servers")
        meta = body.get("meta")
        return (isinstance(servers, list) and len(servers) <= 1
                and isinstance(meta, dict)
                and isinstance(meta.get("pagination"), dict)
                and all(isinstance(server, dict) and type(server.get("id")) is int
                        and server["id"] > 0 for server in servers))
    account = body.get("account")
    if not isinstance(account, dict):
        return False
    if adapter == "digitalocean":
        value = account.get("uuid")
        return isinstance(value, str) and 1 <= len(value) <= 128
    value = account.get("email")
    return isinstance(value, str) and "@" in value and len(value) <= 320


@sensitive_variables("token", "session", "response", "buf", "body")
def verify_cloud_access(adapter, token, *, session_factory=None):
    if (adapter not in _ENDPOINTS or not isinstance(token, str)
            or not 12 <= len(token) <= 4096
            or any(not 33 <= ord(ch) <= 126 for ch in token)):
        raise ProviderReadbackFailed()
    session = (session_factory or requests.Session)()
    session.trust_env = False
    session.headers.clear()
    try:
        with session.get(_ENDPOINTS[adapter], headers={
            "Authorization": "Bearer " + token, "Accept": "application/json",
        }, timeout=(3, 8), verify=True, allow_redirects=False, stream=True) as response:
            if response.status_code != 200:
                raise ProviderReadbackFailed()
            size = response.headers.get("Content-Length", "")
            if size and (not str(size).isdigit() or int(size) > _MAX_BYTES):
                raise ProviderReadbackFailed()
            buf = bytearray()
            for chunk in response.iter_content(chunk_size=4096):
                buf.extend(chunk)
                if len(buf) > _MAX_BYTES:
                    raise ProviderReadbackFailed()
            body = json.loads(buf.decode("utf-8"))
            if not _valid_response(adapter, body):
                raise ProviderReadbackFailed()
        return {"authenticated": True, "read_only": True,
                "provisioning_enabled": False}
    except (requests.RequestException, ValueError, UnicodeError, TypeError):
        # Do not chain an HTTP exception containing a request/response object.
        raise ProviderReadbackFailed() from None
    finally:
        session.close()
