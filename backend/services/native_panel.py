"""Customer-only native hosting panel sessions on the existing vault authority.

No generic proxy, passwords in browser, root access or persistent session URLs.
The MFA-approved supplier policy must explicitly authorize this operation.
"""
import base64
import re
import secrets
from urllib.parse import parse_qs, urlencode, urlsplit

import certifi
import urllib3
from django.db import DatabaseError
from django.utils import timezone
from accounts.security_throttle import _spend
from opanel_bridge.policy import eligible, refresh_candidate
from opanel_bridge.readback import (
    refresh_owned_entitlement, verify_existing_account, ReadbackRejected,
)
from providers.connection_vault import VaultUnavailable
from providers.hosting_runtime import load_hosting_connection
from providers.models import Provider
from providers.pinned_egress import approved_origin, SupplierEgressDenied, SupplierReadResponse


class NativePanelRefused(ValueError):
    """Redacted error: vendor URL, account and credentials must never be logged."""


ACCOUNT = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{1,31}$")
TOKEN = re.compile(r"^[A-Za-z0-9_+./=-]{20,512}$")


def _policy(provider):
    row, key, policy = load_hosting_connection(provider)
    if not isinstance(policy, dict) or policy.get("native_panel_access") is not True:
        raise NativePanelRefused("Native panel access is not authorized.")
    return row, key


def available(service):
    """Read-only local capability, not a claim that a vendor session exists."""
    if not (eligible(service.client_id, service.pk) or
            refresh_candidate(service.client_id, service.pk)):
        return False
    try:
        provider = Provider.objects.get(pk=service.provider_id)
        _policy(provider)
        return True
    except (Provider.DoesNotExist, VaultUnavailable, NativePanelRefused):
        return False


def _fields(body):
    if not isinstance(body, str) or len(body) > 65536:
        raise NativePanelRefused("Invalid supplier response.")
    try:
        parsed = parse_qs(body, keep_blank_values=True, max_num_fields=20)
    except ValueError:
        raise NativePanelRefused("Invalid supplier response.") from None
    if any(len(values) != 1 for values in parsed.values()):
        raise NativePanelRefused("Ambiguous supplier response.")
    return {key: values[0] for key, values in parsed.items()}


def _safe_url(value, origin, *, directadmin, account, session=None, security_token=None):
    if (not isinstance(value, str) or not 1 <= len(value) <= 2500
            or any(ord(ch) < 33 or ord(ch) > 126 for ch in value)
            or "\\" in value):
        raise NativePanelRefused("Supplier returned an invalid session.")
    try:
        target, source = urlsplit(value), urlsplit(origin)
        if (target.scheme != "https" or target.hostname != source.hostname
                or target.username is not None or target.password is not None
                or target.fragment or target.netloc.lower() != target.netloc
                or (target.port or 443) != ((source.port or 443) if directadmin else 2083)):
            raise ValueError()
        fields = parse_qs(target.query, keep_blank_values=True, max_num_fields=2)
        if directadmin:
            key = ("key" if target.path == "/api/login/url" else
                   "hash" if target.path == "/CMD_LOGIN_URL" else None)
            if (key is None or set(fields) != {key} or len(fields[key]) != 1
                    or not TOKEN.fullmatch(fields[key][0])):
                raise ValueError()
        else:
            if (not isinstance(security_token, str)
                    or not re.fullmatch(r"/cpsess[0-9]{10,20}", security_token)
                    or target.path not in (security_token+"/login", security_token+"/login/")
                    or set(fields) != {"session"} or fields["session"] != [session]
                    or not isinstance(session, str) or len(session) > 1000
                    or not session.startswith(account+":")
                    or not re.fullmatch(r"[A-Za-z0-9_:,.-]+", session)):
                raise ValueError()
    except (ValueError, TypeError, KeyError):
        raise NativePanelRefused("Supplier returned an invalid session destination.") from None
    return value


def parse_session(response, origin, adapter, account):
    if response.status_code != 200 or len(response.content) > 65536:
        raise NativePanelRefused("Supplier session could not be confirmed.")
    if adapter == "directadmin":
        fields = _fields(response.text)
        # Current legacy API uses details; some supported releases use result.
        urls = [fields[key] for key in ("details", "result") if key in fields]
        if fields.get("error") != "0" or len(urls) != 1:
            raise NativePanelRefused("DirectAdmin session was not confirmed.")
        return _safe_url(urls[0], origin, directadmin=True, account=account)
    if adapter != "cpanel-whm":
        raise NativePanelRefused("Unsupported native panel.")
    try:
        body = response.json()
        meta, data = body["metadata"], body["data"]
        expiry = int(data["expires"])
        now = int(timezone.now().timestamp())
        if (meta["command"] != "create_user_session" or str(meta["result"]) != "1"
                or data["service"] != "cpaneld" or not now < expiry <= now + 3600):
            raise ValueError()
        return _safe_url(data["url"], origin, directadmin=False, account=account,
                         session=data["session"], security_token=data["cp_security_token"])
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        raise NativePanelRefused("WHM session was not confirmed.") from None


def _session_request(row, provider, account, key):
    """Fixed operation, pinned TLS, no redirects, retries, or browser parameters."""
    if (not ACCOUNT.fullmatch(account or "") or account.lower() in ("root", "admin")
            or account.lower() == provider.username.lower()
            or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{1,79}", provider.username)
            or not isinstance(key, str) or not 12 <= len(key) <= 4096
            or any(ord(ch) < 33 or ord(ch) > 126 for ch in key)):
        raise NativePanelRefused("Invalid supplier account identity.")
    origin = row.public_settings["server_url"]
    da = row.adapter_key == "directadmin"
    if da:
        path, method = "/CMD_API_LOGIN_KEYS", "POST"
        auth = "Basic " + base64.b64encode(
            (provider.username+"|"+account+":"+key).encode()).decode()
        temporary = secrets.token_urlsafe(48)
        fields = {"action": "create", "type": "one_time_url", "key": temporary,
                  "key2": temporary, "passwd": key, "expiry": "2m",
                  "max_uses": "1", "clear_key": "yes"}
    elif row.adapter_key == "cpanel-whm":
        path, method = "/json-api/create_user_session", "GET"
        auth = "whm " + provider.username + ":" + key
        fields = {"api.version": "1", "user": account, "service": "cpaneld"}
    else:
        raise NativePanelRefused("Unsupported native panel.")
    host, port, ip, checked_path = approved_origin(origin+path,
        bound_origin=(origin, row.public_settings["server_ip"]))
    if checked_path != path or port not in ((2222,443) if da else (2087,443)):
        raise NativePanelRefused("Invalid supplier origin.")
    pool = urllib3.HTTPSConnectionPool(host=ip, port=port, server_hostname=host,
        assert_hostname=host, cert_reqs="CERT_REQUIRED", ca_certs=certifi.where(),
        timeout=urllib3.Timeout(connect=3, read=8), retries=False, maxsize=1, block=True)
    headers = {"Authorization": auth, "Accept": "application/json",
               "Host": host if port == 443 else f"{host}:{port}"}
    try:
        args = {"fields": fields}
        if method == "POST":
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            args = {"body": urlencode(fields).encode()}
        response = pool.request(method, path, headers=headers, redirect=False,
                                retries=False, preload_content=False, **args)
        try:
            if (300 <= response.status < 400
                    or int(response.headers.get("content-length", "0")) > 65536):
                raise NativePanelRefused("Supplier returned an unconfirmed session.")
            body = response.read(65537)
            if len(body) > 65536:
                raise NativePanelRefused("Supplier returned an oversized session.")
            return SupplierReadResponse(response.status, body)
        finally:
            response.close()
            response.release_conn()
    except (urllib3.exceptions.HTTPError, ValueError, OSError):
        raise NativePanelRefused("Supplier session could not be confirmed.") from None
    finally:
        pool.close()


def launch(subject_id, service_id):
    """Only a currently entitled owner can request a one-time customer session."""
    candidate = eligible(subject_id, service_id) or refresh_candidate(subject_id, service_id)
    if not candidate:
        raise NativePanelRefused("Hosting access is unavailable.")
    service, initial = candidate
    try:
        provider = Provider.objects.get(pk=service.provider_id)
        row, key = _policy(provider)
        if _spend("hosting:native_panel", str(subject_id), 3, 300):
            raise NativePanelRefused("Hosting access is temporarily limited.")
        # Independent account identity check before minting a bearer session.
        # Refreshing stale proof already makes this read; otherwise check now.
        fresh = refresh_owned_entitlement(subject_id, service_id)
        if not fresh or fresh[1].pk != initial.pk:
            raise NativePanelRefused("Hosting account is not confirmed.")
        service, proof = fresh
        if proof.confirmed_at == initial.confirmed_at:
            verify_existing_account(service, provider)
        current = eligible(subject_id, service_id)
        if not current or current[1].pk != proof.pk or current[1].account_digest != proof.account_digest:
            raise NativePanelRefused("Hosting authority changed.")
        current_provider = Provider.objects.get(pk=service.provider_id)
        current_row, current_key = _policy(current_provider)
        if (current_provider.config != provider.config or current_row.pk != row.pk
                or current_row.current_version != row.current_version or current_key != key
                or current[0].provider_identifier != service.provider_identifier
                or current[0].provider_package_id != service.provider_package_id
                or current[0].domain_name != service.domain_name):
            raise NativePanelRefused("Hosting authority changed.")
        response = _session_request(current_row, current_provider, service.provider_identifier, current_key)
        url = parse_session(response, current_row.public_settings["server_url"],
                            current_row.adapter_key, service.provider_identifier)
        # A revoked, transferred or otherwise changed service never receives
        # the returned one-time URL even if the vendor already minted it.
        final = eligible(subject_id, service_id)
        if (not final or final[1].pk != proof.pk
                or final[1].account_digest != proof.account_digest
                or final[0].provider_identifier != service.provider_identifier
                or final[0].provider_package_id != service.provider_package_id
                or final[0].domain_name != service.domain_name):
            raise NativePanelRefused("Hosting authority changed.")
        return url
    except (Provider.DoesNotExist, VaultUnavailable, SupplierEgressDenied,
            ReadbackRejected, DatabaseError):
        raise NativePanelRefused("Hosting access is unavailable.") from None
