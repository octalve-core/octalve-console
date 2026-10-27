"""Branded, account-scoped Octalve Cloud invoices, without client-supplied markup.

The caller is responsible for the existing InvoiceViewSet owner authorization.
No network requests, financial writes, logo uploads or payment-state inference.
"""
from base64 import b64decode
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from django.conf import settings
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

BLUE = HexColor("#0064E0")
NAVY = HexColor("#071425")
INK = HexColor("#172C44")
MUTED = HexColor("#56667A")
LINE = HexColor("#DCE5EF")
PALE = HexColor("#F2F7FC")
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 48
MAX_ITEMS = 200
LOGO_FILE = Path(__file__).resolve().parent / "assets" / "octalve-cloud-logo.png.b64"


def _text(value, limit=500):
    """Keep default ReportLab fonts safe from control characters and PDF markup."""
    return "".join(c for c in str(value or "")[:limit] if 32 <= ord(c) <= 126)


def _money(value, currency):
    try:
        amount = Decimal(str(value or "0"))
        if not amount.is_finite():
            raise InvalidOperation()
        return f"{_text(currency, 3)} {amount:,.2f}"
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Invalid server-owned invoice amount") from None


def _date(value):
    return value.strftime("%d %b %Y") if hasattr(value, "strftime") else _text(value, 28)


@lru_cache(maxsize=1)
def _logo():
    """Use the identical approved dashboard logo bundled with the API release."""
    return b64decode(LOGO_FILE.read_text(encoding="ascii").strip(), validate=True)


def render_invoice_pdf(invoice):
    """Render a complete, bounded invoice; never silently omit billed items."""
    # Materialize at most 201 rows so an over-limit invoice cannot be truncated
    # into an apparently complete financial document.
    items = list(invoice.items.all().order_by("pk")[:MAX_ITEMS + 1])
    if len(items) > MAX_ITEMS:
        raise ValueError("Invoice exceeds the PDF item limit; use a reviewed exporter")

    currency = _text(invoice.currency, 3)
    number = _text(invoice.invoice_number, 40)
    issued = _date(invoice.issue_date)
    due = _date(invoice.due_date)
    status = _text(invoice.status, 24).upper()

    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=A4, pageCompression=1)
    pdf.setTitle(f"Octalve Cloud Invoice {number}")
    pdf.setAuthor("Octalve Cloud")
    y = 0

    def footer():
        pdf.setStrokeColor(LINE)
        pdf.line(MARGIN, 65, PAGE_WIDTH - MARGIN, 65)
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(MUTED)
        pdf.drawString(MARGIN, 49, "A statement of Octalve Cloud billing records, not independent proof of payment.")
        pdf.drawRightString(PAGE_WIDTH - MARGIN, 49, f"Page {pdf.getPageNumber()}")

    def header(first=False):
        nonlocal y
        pdf.setFillColor(BLUE)
        pdf.rect(0, PAGE_HEIGHT - 9, PAGE_WIDTH, 9, stroke=0, fill=1)
        if first:
            try:
                pdf.drawImage(ImageReader(BytesIO(_logo())), MARGIN, PAGE_HEIGHT - 111,
                              width=196, height=57, preserveAspectRatio=True, anchor="c",
                              mask="auto")
            except (OSError, ValueError) as exc:
                # Missing/corrupt approved branding must not produce an unbranded
                # document that could be mistaken for the approved invoice.
                raise ValueError("Approved invoice logo is unavailable") from exc
        else:
            pdf.setFont("Helvetica-Bold", 14)
            pdf.setFillColor(BLUE)
            pdf.drawString(MARGIN, PAGE_HEIGHT - 75, "OCTALVE CLOUD")
        pdf.setFont("Helvetica-Bold", 21 if first else 16)
        pdf.setFillColor(NAVY)
        pdf.drawRightString(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 66, "INVOICE")
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(MUTED)
        pdf.drawRightString(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 83, number)
        pdf.setStrokeColor(LINE)
        pdf.line(MARGIN, PAGE_HEIGHT - 120, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 120)
        y = PAGE_HEIGHT - (148 if first else 151)

    def room(required):
        nonlocal y
        if y - required >= 88:
            return
        footer()
        pdf.showPage()
        header()

    def label_line(label, value, at_x, at_y):
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(MUTED)
        pdf.drawString(at_x, at_y, _text(label, 40).upper())
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(INK)
        pdf.drawString(at_x, at_y - 15, _text(value, 56))

    header(first=True)
    label_line("Issue date", issued, MARGIN, y)
    label_line("Due date", due, 205, y)
    label_line("Payment status", status, 368, y)
    y -= 58

    # Legal seller data is configured server-side. Never invent an RC/TIN,
    # tax-validation marker, e-invoice identifier, or Nigerian fiscal QR code.
    issuer = [
        _text(getattr(settings, "OCTALVE_INVOICE_ISSUER_NAME", "Octalve Cloud"), 100),
        _text(getattr(settings, "OCTALVE_INVOICE_ISSUER_ADDRESS", ""), 180),
        _text(getattr(settings, "OCTALVE_INVOICE_ISSUER_EMAIL", ""), 100),
        _text(getattr(settings, "OCTALVE_INVOICE_ISSUER_TAX_ID", ""), 64),
    ]
    meta = invoice.metadata if isinstance(invoice.metadata, dict) else {}
    billing = meta.get("billing_contact") if isinstance(meta.get("billing_contact"), dict) else {}
    client_lines = [
        billing.get("full_name") or getattr(invoice.client, "full_name", "") or invoice.client.email,
        billing.get("company_name"),
        billing.get("address"),
        ", ".join(str(billing[k]) for k in ("city", "state", "postal_code")
                  if billing.get(k)),
        billing.get("country"),
        billing.get("email") or invoice.client.email,
        billing.get("tax_id"),
    ]
    pdf.setFillColor(PALE)
    pdf.roundRect(MARGIN, y - 125, PAGE_WIDTH - 2 * MARGIN, 125, 10, fill=1, stroke=0)
    for x, title, values in ((MARGIN + 14, "ISSUED BY", issuer),
                             (PAGE_WIDTH / 2 + 5, "BILL TO", client_lines)):
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColor(BLUE)
        pdf.drawString(x, y - 21, title)
        pos = y - 38
        for value in values:
            if value and pos >= y - 116:
                for part in simpleSplit(_text(value, 180), "Helvetica", 8, 218):
                    if pos < y - 116:
                        break
                    pdf.setFont("Helvetica", 8)
                    pdf.setFillColor(INK)
                    pdf.drawString(x, pos, part)
                    pos -= 12
    y -= 158

    def table_header():
        nonlocal y
        room(35)
        pdf.setFillColor(NAVY)
        pdf.roundRect(MARGIN, y - 25, PAGE_WIDTH - 2 * MARGIN, 28, 5, stroke=0, fill=1)
        pdf.setFillColor(white)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(MARGIN + 12, y - 15, "DESCRIPTION")
        pdf.drawRightString(398, y - 15, "QTY")
        pdf.drawRightString(477, y - 15, "UNIT")
        pdf.drawRightString(PAGE_WIDTH - MARGIN - 12, y - 15, "TOTAL")
        y -= 33

    table_header()
    for item in items:
        description = _text(item.description, 500) or "Invoice item"
        wrapped = simpleSplit(description, "Helvetica", 9, 252)
        row_height = max(34, len(wrapped) * 13 + 14)
        before = pdf.getPageNumber()
        room(row_height + 6)
        if pdf.getPageNumber() != before:
            table_header()
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(INK)
        for idx, fragment in enumerate(wrapped):
            pdf.drawString(MARGIN + 12, y - 13 - idx * 13, fragment)
        pdf.setFont("Helvetica", 8)
        pdf.drawRightString(398, y - 14, _text(item.quantity, 8))
        pdf.drawRightString(477, y - 14, _money(item.unit_price, currency).replace(currency + " ", ""))
        pdf.drawRightString(PAGE_WIDTH - MARGIN - 12, y - 14,
                            _money(item.subtotal, currency).replace(currency + " ", ""))
        y -= row_height
        pdf.setStrokeColor(LINE)
        pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
        y -= 5

    room(169)
    y -= 16
    for label, amount, emphasis in [
        ("Subtotal", invoice.subtotal, False),
        ("Discount", invoice.discount_total, False),
        ("Tax", invoice.tax_total, False),
        ("Total", invoice.total, True),
        ("Amount paid", invoice.amount_paid, False),
        ("Amount due", invoice.amount_due, True),
    ]:
        pdf.setFont("Helvetica-Bold" if emphasis else "Helvetica", 10)
        pdf.setFillColor(BLUE if label == "Amount due" else INK)
        pdf.drawString(310, y, label)
        pdf.drawRightString(PAGE_WIDTH - MARGIN, y, _money(amount, currency))
        y -= 23

    if invoice.notes:
        room(55)
        y -= 7
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColor(BLUE)
        pdf.drawString(MARGIN, y, "INVOICE NOTES")
        y -= 15
        for entry in simpleSplit(_text(invoice.notes, 500), "Helvetica", 9,
                                 PAGE_WIDTH - 2 * MARGIN):
            room(16)
            pdf.setFont("Helvetica", 9)
            pdf.setFillColor(MUTED)
            pdf.drawString(MARGIN, y, entry)
            y -= 14

    footer()
    pdf.save()
    return stream.getvalue()
