"""Reviewed server-owned schemas. Unlisted suppliers remain requirements-only in the UI."""
import ipaddress
import os
import re
from urllib.parse import urlsplit
from rest_framework.exceptions import ValidationError

SCHEMAS = {
    # OPanel is an Octalve-owned application, not a third-party supplier.
    # This metadata schema is inert: actual SSO authority remains in
    # opanel_bridge + independently configured OPANEL_* secret-store settings.
    # Vendor operations and Production credential submission are disabled.
    "opanel": {
        "name": "Octalve OPanel (first-party SSO)",
        "fields": {"panel_url": "url", "client_id": "name"},
        "secrets": ("client_secret",),
        "ports": (443,),
        "guide": "https://github.com/octalve-core/octalve-opanel/blob/main/README.md",
    },
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
        "fields": {"account_id": "identifier", "zone_id": "identifier"},
        "secrets": ("api_token",),
        "ports": (),
        "guide": "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
    },
    "cloudflare-registrar": {
        "name": "Cloudflare Registrar Sandbox (read-only)",
        "fields": {"account_id": "identifier"},
        "secrets": ("api_token",),
        "ports": (),
        "guide": "https://developers.cloudflare.com/api/resources/registrar_sandbox/",
    },
    # Real-time check only. Live registration is intentionally unimplemented:
    # customer billing, registrant approval and supplier reconciliation are
    # independent release gates; no code-owned paid mutation route is exposed.
    "cloudflare-registrar-live": {
        "name": "Cloudflare Registrar (live quotation only)",
        "fields": {"account_id": "identifier"},
        "secrets": ("api_token",),
        "ports": (),
        "guide": "https://developers.cloudflare.com/registrar/registrar-api/",
    },
    "paystack": {
        "name": "Paystack (credential verification only)",
        "fields": {},
        "secrets": ("secret_key",),
        "ports": (),
        "guide": "https://paystack.com/docs/v2/developer-tools/integration/api-keys",
    },
    "google-gemini": {
        "name": "Google Gemini",
        "fields": {},
        "secrets": ("api_key",),
        "ports": (),
        "guide": "https://ai.google.dev/gemini-api/docs/api-key",
    },
    "google-pagespeed": {
        "name": "Google PageSpeed Insights",
        "fields": {},
        "secrets": ("api_key",),
        "ports": (),
        "guide": "https://developers.google.com/speed/docs/insights/v5/get-started",
    },
    "google-web-risk": {
        "name": "Google Web Risk",
        "fields": {},
        "secrets": ("api_key",),
        "ports": (),
        "guide": "https://cloud.google.com/web-risk/docs/lookup-api",
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

# These schemas admit credential storage only. Each runtime must separately
# implement its authentication and supported operations before it consumes them.
for key, name, fields, secrets, ports, guide in (
    ("resellerclub", "ResellerClub", {"reseller_id": "name"}, ("api_key",), (),
     "https://manage.resellerclub.com/kb/answer/753"),
    ("namecheap", "Namecheap", {"api_username": "name"}, ("api_key",), (),
     "https://www.namecheap.com/support/api/intro/"),
    ("opensrs", "OpenSRS", {"reseller_username": "name"}, ("api_key",), (),
     "https://opensrs.com/integrations/"),
    ("flutterwave", "Flutterwave", {}, ("secret_key",), (),
     "https://developer.flutterwave.com/docs"),
    ("monnify", "Monnify", {"contract_code": "name"}, ("api_key", "api_secret"), (),
     "https://developers.monnify.com/"),
    ("plesk", "Plesk", {"server_url": "url"}, ("api_key",), (443, 8443),
     "https://docs.plesk.com/en-US/obsidian/api-rpc/about-xml-api.28709/"),
    ("hetzner", "Hetzner Cloud", {}, ("api_token",), (),
     "https://docs.hetzner.cloud/"),
    ("digitalocean", "DigitalOcean", {}, ("api_token",), (),
     "https://docs.digitalocean.com/reference/api/create-personal-access-token/"),
    ("proxmox", "Proxmox VE", {"server_url": "url"}, ("token_id", "token_secret"), (443, 8006),
     "https://pve.proxmox.com/pve-docs/api-viewer/index.html"),
    ("vultr", "Vultr", {}, ("api_key",), (), "https://www.vultr.com/api/"),
    ("cloudflare-r2", "Cloudflare R2", {"account_id": "identifier", "bucket": "name"},
     ("access_key_id", "secret_access_key"), (), "https://developers.cloudflare.com/r2/get-started/s3/"),
    ("zoho-mail", "Zoho Mail", {"organization_id": "name", "client_id": "name"},
     ("client_secret", "refresh_token"), (), "https://www.zoho.com/mail/help/api/using-oauth-2.html"),
):
    SCHEMAS[key] = {"name": name, "fields": fields, "secrets": secrets, "ports": ports, "guide": guide}

READBACK_ADAPTERS = frozenset({"directadmin", "cpanel-whm", "resellerclub", "cloudflare-dns", "cloudflare-registrar", "cloudflare-registrar-live", "brevo", "resend", "paystack", "google-web-risk", "google-gemini", "google-pagespeed"})


def public_catalog():
    from django.conf import settings
    return [{"key":key,"name":spec["name"],"fields":{**spec["fields"], **({"server_ip":"public_ip"} if key in ("directadmin","cpanel-whm") and getattr(settings,"CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED",False) else {})},
             "secret_fields":list(spec["secrets"]),"guide":spec["guide"],
             "enabled_for_execution":False, "supports_verification":key in READBACK_ADAPTERS}
            for key,spec in SCHEMAS.items()]

def validate_public_settings(adapter, data):
    schema = SCHEMAS.get(adapter)
    from django.conf import settings
    fields = dict(schema["fields"]) if schema else {}
    configured = (adapter in ("directadmin","cpanel-whm") and isinstance(data,dict)
                  and "server_ip" in data and getattr(settings,"CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED",False))
    if configured:
        fields["server_ip"]="public_ip"
    if not schema or not isinstance(data,dict) or set(data) != set(fields):
        raise ValidationError({"public_settings":"Use exactly the approved fields for this adapter."})
    result = {}
    for field,kind in fields.items():
        v=data[field]
        if not isinstance(v,str) or not (1 <= len(v.strip()) <= 220) or v != v.strip():
            raise ValidationError({"public_settings":"One or more required fields are invalid."})
        if kind=="url":
            try:
                parts=urlsplit(v)
            except ValueError:
                raise ValidationError({"public_settings":"A valid HTTPS panel origin is required."}) from None
            if any(ord(ch)<33 for ch in v) or parts.scheme!="https" or not parts.hostname or parts.username or parts.password or parts.path not in ("","/") or parts.query or parts.fragment:
                raise ValidationError({"public_settings":"A clean HTTPS panel origin is required."})
            hostname=parts.hostname.lower().rstrip(".")
            try:
                ipaddress.ip_address(hostname)
                raise ValidationError({"public_settings":"Raw IP addresses are not accepted."})
            except ValueError:
                pass
            if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?",hostname) or ".." in hostname or (configured and ("." not in hostname or hostname.endswith(".local"))):
                raise ValidationError({"public_settings":"Invalid panel hostname."})
            try:
                port=parts.port or 443
            except ValueError:
                raise ValidationError({"public_settings":"Invalid panel port."})
            allowed={s.strip().lower().rstrip(".") for s in os.getenv("CLOUD_CONNECTION_ALLOWED_HOSTS","").split(",") if s.strip()}
            if (not configured and hostname not in allowed) or port not in schema["ports"]:
                raise ValidationError({"public_settings":"Panel host and port must be approved by infrastructure policy."})
            v=f"https://{hostname}:{port}"
        elif kind=="public_ip":
            from .pinned_egress import public_ip
            try:
                v=public_ip(v)
            except ValueError:
                raise ValidationError({"public_settings":"Enter the server’s fixed, globally routable IP address."}) from None
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

def validate_secrets(adapter, data, environment=None):
    schema=SCHEMAS.get(adapter)
    if not schema or not isinstance(data,dict) or set(data)!=set(schema["secrets"]):
        raise ValidationError({"secrets":"Exactly the required credential fields must be supplied."})
    for v in data.values():
        min_length = 32 if adapter == "opanel" else 12
        if not isinstance(v,str) or not (min_length<=len(v)<=4096) or v.strip()!=v or any(ord(c)<32 for c in v):
            raise ValidationError({"secrets":"A credential value has invalid length or characters."})
    if adapter == "paystack":
        key=data["secret_key"]
        if not re.fullmatch(r"sk_(?:test|live)_[A-Za-z0-9_-]{12,200}", key):
            raise ValidationError({"secrets":"A valid Paystack secret key is required (sk_test_ or sk_live_)."})
        if environment not in ("test","live") or not key.startswith("sk_"+environment+"_"):
            raise ValidationError({"secrets":"Paystack key and selected test/live environment must match."})
    return data
