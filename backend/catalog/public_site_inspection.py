"""Read-only public HTTP/TLS inspection using vetted IPs and bounded headers."""
import ipaddress
import json
import re
import socket
import ssl
from datetime import datetime, timezone
from time import monotonic
from urllib.parse import urljoin, urlsplit

import requests
from urllib3.exceptions import HTTPError

from .public_google_tools import PublicGoogleTool, fields
from accounts.account_self_service import reserve_email_attempt
from django.conf import settings
from providers.public_google import PublicGoogleUnavailable
from providers.web_risk import valid_lookup_url
from rest_framework.exceptions import Throttled, ValidationError

DNS_ENDPOINT = "https://dns.google/resolve"
MAX_HOPS = 4
MAX_HEADERS = 16384
BLOCKED_V6 = tuple(ipaddress.IPv6Network(value) for value in (
    "64:ff9b::/96", "64:ff9b:1::/48", "2002::/16", "2001::/32",
))


def remaining(deadline):
    seconds = deadline - monotonic()
    if seconds <= 0:
        raise PublicGoogleUnavailable()
    return seconds


def validate_address(value):
    address = ipaddress.ip_address(value)
    if (not address.is_global or address.is_multicast or address.is_reserved
            or address.is_unspecified or address.is_link_local or address.is_loopback
            or isinstance(address, ipaddress.IPv6Address)
            and (address.ipv4_mapped or any(address in network for network in BLOCKED_V6))):
        raise PublicGoogleUnavailable()
    return address


def public_addresses(host, deadline):
    addresses = []
    try:
        with requests.Session() as conn:
            conn.trust_env = False
            for kind in (1, 28):
                with conn.get(DNS_ENDPOINT, params={"name": host, "type": kind},
                              timeout=min(2, remaining(deadline)), allow_redirects=False, stream=True) as response:
                    if response.status_code != 200:
                        raise PublicGoogleUnavailable()
                    data = response.raw.read(16385, decode_content=True)
                    if len(data) > 16384:
                        raise PublicGoogleUnavailable()
                    result = json.loads(data)
                    remaining(deadline)
                answers = result.get("Answer", [])
                if result.get("Status") != 0 or result.get("TC") or not isinstance(answers, list) or len(answers) > 30:
                    raise PublicGoogleUnavailable()
                addresses.extend(validate_address(answer["data"]) for answer in answers if answer["type"] in (1, 28))
        if not addresses:
            raise PublicGoogleUnavailable()
        return list(dict.fromkeys(addresses))
    except (requests.RequestException, HTTPError, OSError, AttributeError, KeyError, ValueError, TypeError):
        raise PublicGoogleUnavailable() from None


def connect(host, port, deadline):
    addresses = public_addresses(host, deadline)
    ip = addresses[0]
    raw = socket.socket(socket.AF_INET6 if ip.version == 6 else socket.AF_INET, socket.SOCK_STREAM)
    try:
        raw.settimeout(min(3, remaining(deadline)))
        raw.connect((str(ip), port))
        if port == 443:
            raw.settimeout(min(3, remaining(deadline)))
            return ssl.create_default_context().wrap_socket(raw, server_hostname=host)
        return raw
    except BaseException:
        raw.close()
        raise


def inspect_certificate(target, deadline):
    url = urlsplit(target)
    with connect(url.hostname, 443, deadline) as conn:
        certificate = conn.getpeercert()
        protocol = conn.version()
    if not certificate or not protocol:
        raise PublicGoogleUnavailable()
    expiry = datetime.fromtimestamp(ssl.cert_time_to_seconds(certificate["notAfter"]), timezone.utc)
    return {"host": url.hostname, "certificate_verified": True, "expires_at": expiry.isoformat(), "tls": protocol}


def head(target, deadline):
    url = urlsplit(target)
    resource = url.path or "/"
    if url.query:
        resource += "?" + url.query
    with connect(url.hostname, 443 if url.scheme == "https" else 80, deadline) as conn:
        conn.settimeout(remaining(deadline))
        conn.sendall(f"HEAD {resource} HTTP/1.1\r\nHost: {url.hostname}\r\nConnection: close\r\n\r\n".encode("ascii"))
        header = bytearray()
        while b"\r\n\r\n" not in header and len(header) < MAX_HEADERS:
            conn.settimeout(remaining(deadline))
            chunk = conn.recv(min(2048, MAX_HEADERS - len(header)))
            if not chunk:
                break
            header.extend(chunk)
    if b"\r\n\r\n" not in header:
        raise PublicGoogleUnavailable()
    status_line, *lines = header.split(b"\r\n\r\n", 1)[0].split(b"\r\n")
    status = re.fullmatch(rb"HTTP/1\.[01] ([1-5][0-9]{2})(?: [^\r\n]*)?", status_line)
    if not status:
        raise PublicGoogleUnavailable()
    locations = []
    for line in lines:
        if line.startswith((b" ", b"\t")):
            raise PublicGoogleUnavailable()
        name, colon, value = line.partition(b":")
        if not colon:
            raise PublicGoogleUnavailable()
        if name.lower() == b"location":
            locations.append(value.decode("ascii").strip())
    if len(locations) > 1:
        raise PublicGoogleUnavailable()
    return int(status[1]), locations[0] if locations else None


def inspect_redirects(target, deadline):
    visited = set()
    hops = []
    for _ in range(MAX_HOPS + 1):
        if not valid_lookup_url(target) or target in visited:
            raise PublicGoogleUnavailable()
        visited.add(target)
        status, location = head(target, deadline)
        hops.append({"url": target, "status": status})
        if status not in (301, 302, 303, 307, 308):
            return {"hops": hops, "final_url": target}
        if not location or any(ord(char) < 33 or ord(char) >= 127 for char in location):
            raise PublicGoogleUnavailable()
        destination = urljoin(target, location)
        if not valid_lookup_url(destination) or (target.startswith("https://") and not destination.startswith("https://")):
            raise PublicGoogleUnavailable()
        target = destination
    raise PublicGoogleUnavailable()


class PublicSiteInspection(PublicGoogleTool):
    operation = "ssl"

    def validate(self, value):
        value = fields(value, {"url"})
        target = value["url"]
        if not valid_lookup_url(target) or (self.operation == "ssl" and not target.startswith("https://")):
            raise ValidationError("Enter a supported public URL.")
        return value

    def run(self, inputs):
        if not settings.CLOUD_PUBLIC_SITE_INSPECTION_ENABLED:
            raise PublicGoogleUnavailable()
        if not reserve_email_attempt("public-site-inspection", "global", 80, 86400):
            raise Throttled(detail="Inspection limit reached. Try again later.")
        deadline = monotonic() + 12
        try:
            operation = inspect_certificate if self.operation == "ssl" else inspect_redirects
            return operation(inputs["url"], deadline)
        except (OSError, KeyError):
            raise PublicGoogleUnavailable() from None
