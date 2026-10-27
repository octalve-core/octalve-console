"""Octalve invoice DOCUMENT engine: financial readback and allowlisted template dispatch.

Visual layout belongs solely to backend/billing/invoice-template/template_XX.py.
No caller may choose an import path or override authoritative invoice totals/status.
The existing owner-authorized InvoiceViewSet remains responsible for access control.
"""
from base64 import b64decode
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from importlib import import_module
from pathlib import Path

from django.conf import settings

MAX_ITEMS = 200
LOGO_FILE = Path(__file__).resolve().parent / "assets" / "octalve-cloud-logo.png.b64"

# Registration is code reviewed, never arbitrary user or request-driven imports.
# The hyphenated directory exactly matches the requested "invoice-template"
# repository layout; Python loads these fixed paths through importlib.
TEMPLATE_REGISTRY = {
    "template_01": "billing.invoice-template.template_01",
}
DEFAULT_TEMPLATE_ID = "template_01"


def _clean(value, limit=500):
    return "".join(c for c in str(value or "")[:limit] if 32 <= ord(c) <= 126)


def _amount(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite():
            raise InvalidOperation()
        return amount
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Invalid persisted invoice amount") from None


def _date(value):
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y")
    return _clean(value, 32)


@lru_cache(maxsize=1)
def _logo():
    """Same approved dashboard PNG, bundled locally; no external image request."""
    image = b64decode(LOGO_FILE.read_text(encoding="ascii").strip(), validate=True)
    if not image.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Approved logo is not a PNG")
    return image


@dataclass(frozen=True)
class InvoiceLine:
    description: str
    quantity: str
    unit_price: Decimal
    subtotal: Decimal


@dataclass(frozen=True)
class InvoiceDocument:
    invoice_number: str
    status: str
    issue_date: str
    due_date: str
    currency: str
    issuer_name: str
    issuer_address: str
    issuer_email: str
    issuer_tax_id: str
    recipient_name: str
    recipient_company: str
    recipient_address: str
    recipient_location: str
    recipient_country: str
    recipient_email: str
    recipient_tax_id: str
    lines: tuple[InvoiceLine, ...]
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    notes: str
    logo: bytes


def _document(invoice):
    """Build a bounded, immutable read-only snapshot from the authorized invoice."""
    items = list(invoice.items.all().order_by("pk")[:MAX_ITEMS + 1])
    if len(items) > MAX_ITEMS:
        raise ValueError("Invoice exceeds the PDF item limit; use a reviewed exporter")

    meta = invoice.metadata if isinstance(invoice.metadata, dict) else {}
    contact = meta.get("billing_contact")
    billing = contact if isinstance(contact, dict) else {}
    client = invoice.client
    recipient_name = billing.get("full_name") or getattr(client, "full_name", "") or client.email
    issuer_name = getattr(settings, "OCTALVE_INVOICE_ISSUER_NAME", "Octalve Cloud")
    return InvoiceDocument(
        invoice_number=_clean(invoice.invoice_number, 40),
        status=_clean(invoice.status, 24).upper(),
        issue_date=_date(invoice.issue_date),
        due_date=_date(invoice.due_date),
        currency=_clean(invoice.currency, 3).upper(),
        issuer_name=_clean(issuer_name, 100),
        issuer_address=_clean(getattr(settings, "OCTALVE_INVOICE_ISSUER_ADDRESS", ""), 220),
        issuer_email=_clean(getattr(settings, "OCTALVE_INVOICE_ISSUER_EMAIL", ""), 100),
        issuer_tax_id=_clean(getattr(settings, "OCTALVE_INVOICE_ISSUER_TAX_ID", ""), 64),
        recipient_name=_clean(recipient_name, 120),
        recipient_company=_clean(billing.get("company_name"), 120),
        recipient_address=_clean(billing.get("address"), 180),
        recipient_location=_clean(", ".join(str(billing[k]) for k in ("city", "state", "postal_code") if billing.get(k)), 150),
        recipient_country=_clean(billing.get("country"), 80),
        recipient_email=_clean(billing.get("email") or client.email, 120),
        recipient_tax_id=_clean(billing.get("tax_id"), 64),
        lines=tuple(InvoiceLine(
            description=_clean(item.description, 500) or "Invoice item",
            quantity=_clean(item.quantity, 12),
            unit_price=_amount(item.unit_price),
            subtotal=_amount(item.subtotal),
        ) for item in items),
        subtotal=_amount(invoice.subtotal),
        discount_total=_amount(invoice.discount_total),
        tax_total=_amount(invoice.tax_total),
        total=_amount(invoice.total),
        amount_paid=_amount(invoice.amount_paid),
        amount_due=_amount(invoice.amount_due),
        notes=_clean(invoice.notes, 500),
        logo=_logo(),
    )


def render_invoice_pdf(invoice):
    """Public compatibility API, stable across future isolated visual templates.

    Existing invoices without a pinned template key stay on approved template_01.
    Future issuance must pin a versioned identifier and document snapshot; a
    runtime designer must never rewrite past issued documents.
    """
    meta = invoice.metadata if isinstance(invoice.metadata, dict) else {}
    template_id = meta.get("invoice_template_id", DEFAULT_TEMPLATE_ID)
    module_path = TEMPLATE_REGISTRY.get(template_id) if isinstance(template_id, str) else None
    if module_path is None:
        raise ValueError("Invoice references an unsupported template")
    renderer = import_module(module_path).render
    output = renderer(_document(invoice))
    if not isinstance(output, bytes) or not output.startswith(b"%PDF-"):
        raise ValueError("Invoice template did not produce a PDF")
    return output
