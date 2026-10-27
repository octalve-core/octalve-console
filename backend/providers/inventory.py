"""Read-only supplier inventory adapters for our own DirectAdmin/WHM servers.

Never use this module for account creation or pricing publication. Hostname
allowlisting must be configured on the server by the infrastructure operator.
The allowlist prevents browser/admin-created provider URLs from becoming a
general-purpose authenticated SSRF proxy. DNS/rebinding protection and worker
egress policy are additionally required before enabling external deployments.
"""
import base64
import os
from urllib.parse import parse_qs, urlsplit

import requests
from .pinned_egress import pinned_get
from rest_framework.exceptions import ValidationError


class InventoryError(Exception):
    pass


SUPPORTED = {"DirectAdminAdapter", "CpanelAdapter"}
DA_SPEC_KEYS = ("quota", "bandwidth", "vdomains", "domainptr", "nemails", "mysql", "ftp", "nsubdomains", "ssl", "dnscontrol")
WHM_SPEC_KEYS = ("QUOTA", "BWLIMIT", "MAXSQL", "MAXPOP", "MAXADDON", "MAXPARK", "MAXFTP", "MAXSUB", "MAXLST", "MAX_EMAIL_PER_HOUR", "CPMOD")


def normalize_directadmin_list(payload):
    """Support canonical URL-encoded legacy lists and documented JSON mode."""
    if isinstance(payload, str):
        data = parse_qs(payload, keep_blank_values=True)
        if "error" in data and any(v != "0" for v in data["error"]):
            raise InventoryError("DirectAdmin rejected the package-list operation.")
        names = data.get("list[]", []) or data.get("list", [])
        if len(names) == 1 and "&" in names[0]:
            raise InventoryError("Unexpected encoded package-list structure.")
    elif isinstance(payload, dict):
        if str(payload.get("error", "0")) not in ("0", "False", "false"):
            raise InventoryError("DirectAdmin package-list request failed.")
        names = payload.get("list") or payload.get("packages") or []
    elif isinstance(payload, list):
        names = payload
    else:
        raise InventoryError("Unrecognized DirectAdmin package response.")
    if isinstance(names, str):
        names = [names]
    if not isinstance(names, list) or len(names) > 100:
        raise InventoryError("Invalid or oversized DirectAdmin package list.")
    if not all(isinstance(x, str) and 0 < len(x) <= 200 for x in names):
        raise InventoryError("Invalid DirectAdmin package identifier.")
    return list(dict.fromkeys(names))


def normalize_directadmin_detail(name, payload):
    if isinstance(payload, str):
        data = {k: v[0] for k, v in parse_qs(payload, keep_blank_values=True).items()}
    elif isinstance(payload, dict):
        data = payload
    else:
        raise InventoryError("Invalid DirectAdmin package details.")
    if str(data.get("error", "0")) not in ("0", "False", "false"):
        raise InventoryError("DirectAdmin package detail returned an error.")
    if not any(key in data for key in ("quota", "bandwidth", "vdomains")):
        raise InventoryError("DirectAdmin package details lack hosting resource limits.")
    return {"provider_package_id": name, "name": name,
            "specs": {k: str(data[k])[:100] for k in DA_SPEC_KEYS if k in data}}


def normalize_whm_packages(payload):
    if not isinstance(payload, dict) or str(payload.get("metadata", {}).get("result")) != "1":
        raise InventoryError("WHM listpkgs request was not successful.")
    data = payload.get("data", {})
    pkgs = data.get("pkg") if isinstance(data, dict) else None
    if not isinstance(pkgs, list) or len(pkgs) > 100:
        raise InventoryError("WHM package inventory is invalid or oversized.")
    seen = set()
    offers = []
    for item in pkgs:
        if not isinstance(item, dict):
            raise InventoryError("Malformed WHM package.")
        name = item.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 200 or name in seen:
            raise InventoryError("Invalid or duplicate WHM package name.")
        seen.add(name)
        specs = {k.lower(): str(item[k])[:100] for k in WHM_SPEC_KEYS if k in item}
        offers.append({"provider_package_id": name, "name": name, "specs": specs})
    return offers


def _endpoint(provider):
    """Only HTTPS endpoints whose *exact hostname* is explicitly approved."""
    parsed = urlsplit(provider.base_url)
    host = (parsed.hostname or "").lower().rstrip(".")
    allowed = {v.strip().lower().rstrip(".") for v in os.environ.get(
        "CLOUD_INVENTORY_ALLOWED_HOSTS", "").split(",") if v.strip()}
    if not host or host not in allowed or parsed.scheme != "https" or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise InventoryError("Provider API origin must be HTTPS and explicitly allowlisted.")
    if provider.adapter_type == "DirectAdminAdapter" and parsed.port not in (2222, 443):
        raise InventoryError("DirectAdmin inventory requires HTTPS port 2222 or 443.")
    if provider.adapter_type == "CpanelAdapter" and parsed.port not in (2087, 443):
        raise InventoryError("WHM inventory requires HTTPS port 2087 or 443.")
    if provider.adapter_type not in SUPPORTED:
        raise InventoryError("No audited inventory adapter for this provider type.")
    return provider.base_url.rstrip("/")


def fetch_inventory(provider, *, getter=None):
    """Fetch inventory only; never mutate provider or Django records here."""
    origin = _endpoint(provider)
    getter = getter or pinned_get
    key = provider.get_api_key()
    if not provider.username or not key:
        raise InventoryError("Provider account name and encrypted API token are required.")
    headers = {"Accept": "application/json"}
    if provider.adapter_type == "DirectAdminAdapter":
        token = base64.b64encode(f"{provider.username}:{key}".encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    else:
        headers["Authorization"] = f"whm {provider.username}:{key}"

    def fetch(path, params):
        try:
            response = getter(origin + path, params=params, headers=headers,
                              timeout=min(max(provider.timeout_seconds or 10, 1), 15),
                              allow_redirects=False, verify=True)
        except requests.RequestException:
            raise InventoryError("Provider inventory connection failed.")
        if response.status_code != 200 or len(response.content) > 1000000:
            raise InventoryError("Provider rejected inventory request.")
        return response

    if provider.adapter_type == "CpanelAdapter":
        try:
            body = fetch("/json-api/listpkgs", {"api.version": "1", "want": "creatable"}).json()
        except ValueError:
            raise InventoryError("WHM returned invalid JSON.")
        return normalize_whm_packages(body)

    response = fetch("/CMD_API_PACKAGES_USER", {})
    raw = response.text
    # DirectAdmin's canonical legacy endpoint returns url-encoded arrays.
    names = normalize_directadmin_list(raw)
    if not names:
        raise InventoryError("DirectAdmin returned no eligible packages; sync was not applied.")
    offers = []
    for name in names:
        details = fetch("/CMD_API_PACKAGES_USER", {"package": name}).text
        offers.append(normalize_directadmin_detail(name, details))
    return offers
