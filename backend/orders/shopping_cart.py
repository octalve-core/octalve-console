"""Server-owned guest selections using the existing Cart table."""
import hashlib
import re
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from accounts.account_self_service import reserve_email_attempt
from domains.models import TLDPricing
from domains.public_registrar import public_availability
from domains.registrar_quote import HOSTNAME

from .models import Cart
from .serializers import CreateOrderSerializer

COOKIE = "__Host-octalve-shopping"
GUEST_TTL = timedelta(hours=24)
CONSOLE = "https://console.cloud.octalve.com"
STOREFRONT = "https://cloud.octalve.com"
MAX_ITEMS = 20
SALT = "octalve-shopping-claim-v1"
TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")


class ShoppingThrottle(AnonRateThrottle):
    scope = "shopping_cart"
    rate = "24/min"


def require_surface(request, *origins):
    if not settings.CLOUD_UNIFIED_SHOPPING_ENABLED:
        raise NotFound()
    if request.headers.get("Origin") not in origins:
        raise PermissionDenied("Shopping origin is not allowed.")


def response(data, status=200):
    return Response(data, status=status, headers={"Cache-Control": "private, no-store"})


def assert_payload_size(request):
    try:
        size = int(request.META.get("CONTENT_LENGTH", "0"))
    except (ValueError, TypeError):
        size = 0
    if not 1 <= size <= 8192:
        raise ValidationError("Invalid shopping request size.")


def digest(prefix, value):
    return prefix + hashlib.sha256(value.encode("ascii")).hexdigest()[:40 - len(prefix)]


def guest_token(request):
    value = request.COOKIES.get(COOKIE, "")
    return value if TOKEN.fullmatch(value) else ""


def guest_cart(request, *, lock=False):
    token = guest_token(request)
    if not token:
        return None
    rows = Cart.objects.filter(
        session_key=digest("shopg_", token), client__isnull=True,
        created_at__gte=timezone.now() - GUEST_TTL,
    )
    return (rows.select_for_update() if lock else rows).first()


def service_payload(item):
    return {
        "plan_id": int(item["plan"]), "cycle_key": item["cycle"], "offer_revision": item["revision"],
        "quantity": 1, "domain_name": item.get("domain", ""),
    }


def exact_selection(data):
    if not isinstance(data, dict):
        raise ValidationError("Choose a valid published item.")
    kind = data.get("kind")
    if kind == "domain" and set(data) == {"kind", "domain"} and isinstance(data["domain"], str) and HOSTNAME.fullmatch(data["domain"]):
        return dict(data)
    if kind == "service" and {"kind", "plan", "cycle", "revision"} <= data.keys() <= {"kind", "plan", "cycle", "revision", "domain"}:
        plan, cycle, revision, domain = data["plan"], data["cycle"], data["revision"], data.get("domain", "")
        if (isinstance(plan, str) and re.fullmatch(r"[1-9][0-9]{0,11}", plan)
                and isinstance(cycle, str) and re.fullmatch(r"[a-z0-9_-]{1,25}", cycle)
                and type(revision) is int and 0 < revision <= 2147483647
                and isinstance(domain, str) and (not domain or HOSTNAME.fullmatch(domain))):
            return {key: value for key, value in data.items() if key != "domain" or value}
    raise ValidationError("Choose a valid published item.")


def selection_id(item):
    if item["kind"] == "domain":
        return "domain:" + item["domain"]
    return ":".join([item["kind"], item["plan"], item["cycle"]] + ([item["domain"]] if item.get("domain") else []))


def domain_price(domain):
    prices = TLDPricing.objects.filter(status="active", register_price__gt=0)
    return max((price for price in prices if domain.endswith("." + price.tld.lstrip(".").lower())),
               key=lambda price: len(price.tld), default=None)


def priced_line(item, *, verify_domain=False):
    if item["kind"] == "domain":
        price = domain_price(item["domain"])
        if not price or (verify_domain and public_availability(price, item["domain"]) != "available"):
            raise ValidationError("Domain availability or pricing could not be confirmed.")
        return {
            "kind": "domain", "name": item["domain"], "currency": "NGN", "amount": str(price.register_price),
            "renewal": str(price.renewal_price), "period": "1 year",
        }
    serializer = CreateOrderSerializer(data={"items": [service_payload(item)], "checkout_id": uuid.uuid4()})
    serializer.is_valid(raise_exception=True)
    entry = serializer.validated_data["items"][0]
    plan, cycle = entry["plan"], entry["billing_cycle"]
    return {"kind": entry["item_type"], "name": plan.name, "currency": plan.currency,
            "amount": str(entry["unit_price"]), "setup_fee": str(cycle.setup_fee), "period": cycle.label}


def snapshot(cart):
    lines = []
    for item in cart.items if cart else []:
        line = {"id": selection_id(item), "selection": item}
        try:
            with transaction.atomic():
                line.update(priced_line(item))
            line["ready"] = True
        except ValidationError:
            line["ready"] = False
        lines.append(line)
    currencies = {line.get("currency") for line in lines if line["ready"]}
    currency = next(iter(currencies)) if len(currencies) == 1 and all(line["ready"] for line in lines) else None
    subtotal = str(sum((Decimal(line["amount"]) for line in lines), Decimal("0.00"))) if currency else None
    return {"lines": lines, "subtotal": subtotal, "currency": currency}


@api_view(["GET", "POST", "DELETE"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([ShoppingThrottle])
def guest_shopping(request):
    require_surface(request, STOREFRONT)
    if request.method == "GET":
        return response(snapshot(guest_cart(request)))
    assert_payload_size(request)
    data = request.data
    if request.method == "POST":
        if isinstance(data, dict) and set(data) == {"bundle"}:
            names = data["bundle"]
            if not isinstance(names, list) or not 1 <= len(names) <= 4 or not all(isinstance(name, str) for name in names) or len(set(names)) != len(names):
                raise ValidationError("Choose up to four unique domains.")
            incoming = [exact_selection({"kind": "domain", "domain": name}) for name in names]
        else:
            incoming = [exact_selection(data)]
        if not reserve_email_attempt("shopping-guest-write", "global", 500, 86400):
            raise Throttled(detail="Cart updates are temporarily limited.")
        for item in incoming:
            if item["kind"] == "domain":
                # Registrar IO must not hold a cart or catalogue row lock.
                priced_line(item, verify_domain=True)
    else:
        if not isinstance(data, dict) or set(data) != {"id"} or not isinstance(data["id"], str) or len(data["id"]) > 310:
            raise ValidationError("Choose a valid cart item.")
    set_token = None
    with transaction.atomic():
        cart = guest_cart(request, lock=True)
        if request.method == "POST":
            if cart is None:
                set_token = secrets.token_urlsafe(32)
                cart = Cart.objects.create(session_key=digest("shopg_", set_token))
            selections = {selection_id(saved): saved for saved in cart.items}
            for item in incoming:
                if item["kind"] == "service":
                    priced_line(item)
                selections[selection_id(item)] = item
            if len(selections) > MAX_ITEMS:
                raise ValidationError("Your cart can contain up to 20 items.")
            cart.items = list(selections.values())
        elif cart:
            cart.items = [item for item in cart.items if selection_id(item) != data["id"]]
        if cart:
            cart.save(update_fields=["items", "updated_at"])
    result = response(snapshot(cart))
    if set_token:
        result.set_cookie(COOKIE, set_token, max_age=int(GUEST_TTL.total_seconds()), secure=True,
                          httponly=True, samesite="Strict", path="/")
    return result


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def claim_grant(request):
    if not settings.CLOUD_UNIFIED_SHOPPING_ENABLED:
        raise NotFound()
    if getattr(request.user, "role", None) != "client":
        raise PermissionDenied()
    return response({"grant": signing.dumps({"client": request.user.pk, "nonce": secrets.token_urlsafe(18)}, salt=SALT)})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([ShoppingThrottle])
def claim_guest(request):
    require_surface(request, CONSOLE)
    assert_payload_size(request)
    data = request.data
    if not isinstance(data, dict) or set(data) != {"grant"} or not isinstance(data["grant"], str) or len(data["grant"]) > 300:
        raise ValidationError("Invalid shopping claim.")
    try:
        grant = signing.loads(data["grant"], salt=SALT, max_age=45)
        owner, nonce = grant["client"], grant["nonce"]
    except (signing.BadSignature, KeyError, TypeError):
        raise PermissionDenied("Shopping claim expired.") from None
    with transaction.atomic():
        guest = guest_cart(request, lock=True)
        if guest is None:
            return response({"lines": []})
        if not reserve_email_attempt("shopping-claim-grant", nonce, 1, 120):
            raise PermissionDenied("Shopping claim has already been used.")
        if not get_user_model().objects.filter(pk=owner, role="client", is_active=True).exists():
            raise PermissionDenied()
        account = account_cart(owner)
        selections = {selection_id(item): item for item in account.items}
        for item in guest.items:
            key = selection_id(item)
            if key not in selections and len(selections) < MAX_ITEMS:
                try:
                    with transaction.atomic():
                        priced_line(item)
                except ValidationError:
                    continue
                selections[key] = item
        account.items = list(selections.values())
        account.save(update_fields=["items", "updated_at"])
        guest.delete()
    result = response(snapshot(account))
    result.delete_cookie(COOKIE, path="/", samesite="Strict")
    return result


def account_cart(owner):
    # The existing unique session_key constraint supplies the cross-process creation guard.
    key = digest("shopa_", str(owner))
    cart, _ = Cart.objects.select_for_update().get_or_create(session_key=key, defaults={"client_id": owner})
    if cart.client_id != owner:
        raise PermissionDenied()
    return cart


@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def account_shopping(request):
    if not settings.CLOUD_UNIFIED_SHOPPING_ENABLED:
        raise NotFound()
    if getattr(request.user, "role", None) != "client":
        raise PermissionDenied()
    key = digest("shopa_", str(request.user.pk))
    if request.method == "GET":
        return response(snapshot(Cart.objects.filter(session_key=key, client=request.user).first()))
    assert_payload_size(request)
    if request.method == "POST":
        data = request.data
        if not isinstance(data, dict) or set(data) != {"selections"} or not isinstance(data["selections"], list) or not 1 <= len(data["selections"]) <= MAX_ITEMS:
            raise ValidationError("Choose a valid cart selection.")
        incoming = [exact_selection(item) for item in data["selections"]]
        for item in incoming:
            if item["kind"] == "domain":
                priced_line(item, verify_domain=True)
    else:
        data = request.data
        if not isinstance(data, dict) or set(data) != {"id"} or not isinstance(data["id"], str) or len(data["id"]) > 310:
            raise ValidationError("Choose a valid cart item.")
    with transaction.atomic():
        cart = account_cart(request.user.pk)
        selections = {selection_id(item): item for item in cart.items}
        if request.method == "POST":
            for item in incoming:
                if item["kind"] == "service":
                    priced_line(item)
                selections[selection_id(item)] = item
        else:
            selections.pop(data["id"], None)
        if len(selections) > MAX_ITEMS:
            raise ValidationError("Your cart can contain up to 20 items.")
        cart.items = list(selections.values())
        cart.save(update_fields=["items", "updated_at"])
    return response(snapshot(cart))
