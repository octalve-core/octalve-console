"""Reviewed server-owned schemas. Unlisted suppliers remain requirements-only in the UI."""
import ipaddress
import os
import re
from urllib.parse import urlsplit
from rest_framework.exceptions import ValidationError

SCHEMAS = {
    "directadmin": {
        "name": "DirectAdmin",
        "fields": {"server_url": "url", "username": "name"},
        "secrets": ("login_key",),
        "ports": (2222, 443),
        "guide": "https://docs.directadmin.com/developer/api/",
    },
    "cpanel-whm": {
        "name": "cPanel / WHM",
        "fields": {"server_url": "url", "username": "name"},
        "secrets": ("api_token",),
        "ports": (2087, 443),
        "guide": "https://docs.cpanel.net/whm/development/manage-api-tokens-in-whm/",
    },
    "cloudflare-dns": {
        "name": "Cloudflare DNS",
        "fields": {"zone_id": "identifier"},
        "secrets": ("api_token",),
        "ports": (),
        "guide": "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
    },
    "brevo": {
        "name": "Brevo (transactional mail, primary)",
        "fields": {"sending_domain": "domain"},
        "secrets": ("api_key",),
        "ports": (),
        "guide": "https://developers.brevo.com/docs/send-a-transactional-email",
    },
    "resend": {
        "name": "Resend (transactional mail)",
        "fields": {"sending_domain": "domain"},
        "secrets": ("api_key",),
        "ports": (),
        "guide": "https://resend.com/docs/dashboard/api-keys/introduction",
    },
}

def public_catalog():
    return [{"key":key,"name":spec["name"],"fields":spec["fields"],
             "secret_fields":list(spec["secrets"]),"guide":spec["guide"],
             "enabled_for_execution":False}
            for key,spec in SCHEMAS.items()]

def validate_public_settings(adapter, data):
    schema = SCHEMAS.get(adapter)
    if not schema or not isinstance(data,dict) or set(data) != set(schema["fields"]):
        raise ValidationError({"public_settings":"Use exactly the approved fields for this adapter."})
    result = {}
    for field,kind in schema["fields"].items():
        v=data[field]
        if not isinstance(v,str) or not (1 <= len(v.strip()) <= 220) or v != v.strip():
            raise ValidationError({"public_settings":"One or more required fields are invalid."})
        if kind=="url":
            parts=urlsplit(v)
            if parts.scheme!="https" or not parts.hostname or parts.username or parts.password or parts.path not in ("","/") or parts.query or parts.fragment:
                raise ValidationError({"public_settings":"A clean HTTPS panel origin is required."})
            hostname=parts.hostname.lower().rstrip(".")
            try:
                ipaddress.ip_address(hostname)
                raise ValidationError({"public_settings":"Raw IP addresses are not accepted."})
            except ValueError:
                pass
            if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?",hostname) or ".." in hostname:
                raise ValidationError({"public_settings":"Invalid panel hostname."})
            try:
                port=parts.port or 443
            except ValueError:
                raise ValidationError({"public_settings":"Invalid panel port."})
            allowed={s.strip().lower().rstrip(".") for s in os.getenv("CLOUD_CONNECTION_ALLOWED_HOSTS","").split(",") if s.strip()}
            if hostname not in allowed or port not in schema["ports"]:
                raise ValidationError({"public_settings":"Panel host and port must be approved by infrastructure policy."})
            v=f"https://{hostname}:{port}"
        elif kind=="domain":
            v=v.lower()
            if not re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+",v):
                raise ValidationError({"public_settings":"Invalid domain."})
        elif kind=="identifier":
            if not re.fullmatch(r"[a-fA-F0-9]{32}",v):
                raise ValidationError({"public_settings":"Expected a 32-character zone identifier."})
        elif kind=="name":
            if not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}",v):
                raise ValidationError({"public_settings":"Invalid account name."})
        result[field]=v
    return result

def validate_secrets(adapter, data):
    schema=SCHEMAS.get(adapter)
    if not schema or not isinstance(data,dict) or set(data)!=set(schema["secrets"]):
        raise ValidationError({"secrets":"Exactly the required credential fields must be supplied."})
    for v in data.values():
        if not isinstance(v,str) or not (12<=len(v)<=4096) or v.strip()!=v or any(ord(c)<32 for c in v):
            raise ValidationError({"secrets":"A credential value has invalid length or characters."})
    return data
