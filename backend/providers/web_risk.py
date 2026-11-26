"""Fixed-origin Google Web Risk client. The submitted URL is query data only."""
import json
import re
from urllib.parse import urlsplit

import requests
from urllib3.exceptions import HTTPError

ENDPOINT = "https://webrisk.googleapis.com/v1/uris:search"
THREATS = ("MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE")
DOMAIN = re.compile(r"(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}", re.ASCII)
PRIVATE_SUFFIXES = {"localhost", "local", "internal", "invalid", "test", "example", "onion", "lan", "home", "arpa"}


class WebRiskUnavailable(ValueError):
    pass


def valid_lookup_url(value):
    if (not isinstance(value, str) or not 8 <= len(value) <= 2048
            or any(ord(char) < 33 or ord(char) >= 127 for char in value)
            or "\\" in value or "#" in value):
        return False
    try:
        url = urlsplit(value)
        host = url.hostname or ""
        return (
            url.scheme in ("https", "http") and url.netloc == host
            and DOMAIN.fullmatch(host) is not None
            and host.rsplit(".", 1)[-1] not in PRIVATE_SUFFIXES
            and not re.fullmatch(r"(?:0x[0-9a-f]+|[0-9]+)", host.rsplit(".", 1)[-1])
        )
    except ValueError:
        return False


def lookup(api_key, target):
    if not valid_lookup_url(target) or not isinstance(api_key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", api_key):
        raise WebRiskUnavailable()
    try:
        with requests.Session() as session:
            session.trust_env = False
            with session.get(
                ENDPOINT, params={"uri": target, "threatTypes": THREATS},
                headers={"Accept": "application/json", "X-Goog-Api-Key": api_key, "Accept-Encoding": "identity"},
                timeout=(3, 5), allow_redirects=False, stream=True,
            ) as response:
                if response.status_code != 200:
                    raise WebRiskUnavailable()
                data = response.raw.read(8193, decode_content=True)
                if len(data) > 8192:
                    raise WebRiskUnavailable()
                packet = json.loads(data)
        if packet == {}:
            return []
        if not isinstance(packet, dict) or not isinstance(packet.get("threat"), dict):
            raise WebRiskUnavailable()
        threats = packet["threat"].get("threatTypes")
        if not isinstance(threats, list) or not threats or len(threats) > len(THREATS) or any(t not in THREATS for t in threats):
            raise WebRiskUnavailable()
        return list(dict.fromkeys(threats))
    except (requests.RequestException, HTTPError, OSError, UnicodeError, TypeError, ValueError):
        raise WebRiskUnavailable() from None
