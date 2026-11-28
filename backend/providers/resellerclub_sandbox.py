"""ResellerClub v2 credential qualification, independently selected environments."""
import json
import re
import requests

class ResellerClubUnavailable(ValueError):
    def __str__(self):
        return "ResellerClub sandbox readback could not be certified."

def verify_credentials(reseller_id, api_key, environment, *, session_factory=None):
    if (environment not in ("test","live") or not isinstance(reseller_id, str)
            or not re.fullmatch(r"[0-9]{1,20}", reseller_id)
            or not isinstance(api_key, str) or not 12 <= len(api_key) <= 512
            or any(ord(c) < 33 or ord(c) > 126 for c in api_key)):
        raise ResellerClubUnavailable()
    session = (session_factory or requests.Session)()
    session.trust_env = False
    session.headers.clear()
    try:
        # Authenticated account-specific endpoint; an empty action list is valid.
        with session.get(("https://api.sandbox.resellerclub.com/v2" if environment=="test" else "https://api.resellerclub.com/v2")+"/actions/search-current",
                         params={"size": 1, "page": 1},
                         headers={"Authorization": "ApiKey " + api_key, "X-User-Id": reseller_id,
                                  "Accept": "application/json"},
                         timeout=(3, 8), verify=True, allow_redirects=False, stream=True) as response:
            if response.status_code != 200:
                raise ResellerClubUnavailable()
            buf = bytearray()
            for part in response.iter_content(chunk_size=4096):
                buf.extend(part)
                if len(buf) > 65536:
                    raise ResellerClubUnavailable()
            data = json.loads(buf.decode("utf-8"))
            if (not isinstance(data, dict) or type(data.get("totalItems")) is not int
                    or type(data.get("itemsOnPage")) is not int or not isinstance(data.get("actions"), list)
                    or data["totalItems"] < 0 or not 0 <= data["itemsOnPage"] <= 1
                    or len(data["actions"]) != data["itemsOnPage"]
                    or data["totalItems"] < data["itemsOnPage"]
                    or any(not isinstance(row, dict) for row in data["actions"])):
                raise ResellerClubUnavailable()
            return {"authenticated": True, "environment": environment, "read_only": True,
                    "registration_enabled": False, "catalogue_verified": False}
    except (requests.RequestException, ValueError, UnicodeError, TypeError) as exc:
        raise ResellerClubUnavailable() from exc
    finally:
        session.close()


def verify_sandbox(reseller_id,api_key,environment,*,session_factory=None):
    # Preserve the old explicit sandbox-only contract.
    if environment!="test":
        raise ResellerClubUnavailable()
    return verify_credentials(reseller_id,api_key,environment,session_factory=session_factory)
