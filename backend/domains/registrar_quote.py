"""Explicit external registrar quote contract (no registrar integration enabled).

Never mistake a typed domain, an internally priced invoice or a provider's
cached prices for authoritative availability/registration. Actual registrar
operations are separately approved, immutable and reconciled later.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import re


HOSTNAME = re.compile(r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$")
REF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{5,100}$")
MAX_YEARS = 10


class RegistrarNotReady(ValueError):
    pass


@dataclass(frozen=True)
class RegistrarQuote:
    domain: str
    tld: str
    term_years: int
    currency: str
    supplier_cost: Decimal
    retail_price: Decimal
    discount: Decimal
    supplier_reference: str
    checked_at: datetime
    expires_at: datetime
    source: str
    available: bool
    executable: bool = False


def _money(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise RegistrarNotReady("Invalid registrar currency amount.")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise RegistrarNotReady("Invalid registrar currency amount.") from None
    if not number.is_finite() or number < 0 or number.as_tuple().exponent < -2 or number > Decimal("9999999999"):
        raise RegistrarNotReady("Invalid registrar currency amount.")
    return number


def preview_domain_quote(*, domain, tld, years, supplier, retail_price,
                         discount="0.00", now=None):
    """Input supplier must be a server-side approved authoritative readback.

    Caller may not pass arbitrary browser JSON as supplier! The executable
    indicator always remains false: no connected registrar/credentials exist.
    """
    now = now or datetime.now(timezone.utc)
    if (not isinstance(domain, str) or domain != domain.lower()
            or not HOSTNAME.fullmatch(domain) or not isinstance(tld, str)
            or not 1 <= len(tld) <= 50 or tld != tld.lower()
            or not tld.startswith(".") or not domain.endswith(tld)
            or type(years) is not int or not 1 <= years <= MAX_YEARS
            or not isinstance(supplier, dict) or not isinstance(now, datetime)
            or now.tzinfo is None):
        raise RegistrarNotReady("Registrar domain or period is invalid.")
    source = supplier.get("source")
    checked = supplier.get("checked_at")
    expires = supplier.get("expires_at")
    reference = supplier.get("reference")
    if (source != "approved_registrar_api" or supplier.get("domain") != domain
            or supplier.get("tld") != tld or supplier.get("years") != years
            or supplier.get("available") is not True
            or not isinstance(reference, str) or not REF.fullmatch(reference)
            or not isinstance(checked, datetime) or checked.tzinfo is None
            or not isinstance(expires, datetime) or expires.tzinfo is None
            or checked > now or now >= expires
            or expires - checked > timedelta(minutes=15)
            or now - checked > timedelta(minutes=15)):
        raise RegistrarNotReady("Fresh authoritative registrar availability is required.")
    currency = supplier.get("currency")
    if not isinstance(currency, str) or not re.fullmatch(r"[A-Z]{3}", currency):
        raise RegistrarNotReady("Registrar currency is invalid.")
    cost = _money(supplier.get("cost"))
    retail = _money(retail_price)
    rebate = _money(discount)
    if cost <= 0 or retail <= 0 or rebate > retail or retail - rebate < cost:
        raise RegistrarNotReady("Retail domain price cannot undercut supplier settlement.")
    return RegistrarQuote(
        domain=domain, tld=tld, term_years=years, currency=currency,
        supplier_cost=cost, retail_price=retail, discount=rebate,
        supplier_reference=reference, checked_at=checked, expires_at=expires,
        available=True, source=source, executable=False)


def execute_domain_registration(*_args, **_kwargs):
    """Never create local 'active' Domain without registrar-side transaction."""
    raise RegistrarNotReady("Real registrar registration/renewal is not connected.")


def execute_nameserver_change(*_args, **_kwargs):
    raise RegistrarNotReady("Registrar-authoritative nameserver update is disabled.")
