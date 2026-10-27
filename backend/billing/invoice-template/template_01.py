"""Invoice Template 01 — approved clean Octalve Cloud A4 design.

Only layout lives here. No ORM, pricing, status decisions, permission checks,
provider calls or financial writes. To add Template 02, create a separate
template_02.py and register a fixed path in billing.invoice_pdf.
"""
from io import BytesIO
from typing import TYPE_CHECKING

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

if TYPE_CHECKING:
    from billing.invoice_pdf import InvoiceDocument

BLUE = HexColor("#0064E0")
NAVY = HexColor("#071425")
INK = HexColor("#172C44")
MUTED = HexColor("#56667A")
BORDER = HexColor("#DCE5EF")
PALE = HexColor("#F2F7FC")
RED = HexColor("#BE123C")
GREEN = HexColor("#047857")
WIDTH, HEIGHT = A4
LEFT, RIGHT = 48, A4[0] - 48
BOTTOM = 88


def _money(amount, currency):
    return f"{currency} {amount:,.2f}"


def _wrap(text, size, width):
    return simpleSplit(str(text or ""), "Helvetica", size, width)


class _NumberedCanvas(canvas.Canvas):
    """Add correct Page X of Y at final save without premature page-count guesses."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_states = []

    def showPage(self):
        self._saved_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        # Canvas.save() would add the last page only *after* our count.
        # Flush it first, then stamp every stored page with the true total.
        if self._code:
            self.showPage()
        count = len(self._saved_states)
        for state in self._saved_states:
            self.__dict__.update(state)
            self.setFont("Helvetica", 8)
            self.setFillColor(MUTED)
            self.drawRightString(RIGHT, 48, f"Page {self._pageNumber} of {count}")
            super().showPage()
        super().save()


def render(document: "InvoiceDocument") -> bytes:
    """Render a fully server-authorized, frozen document snapshot."""
    stream = BytesIO()
    pdf = _NumberedCanvas(stream, pagesize=A4, pageCompression=1)
    pdf.setTitle(f"Octalve Cloud Invoice {document.invoice_number}")
    pdf.setAuthor("Octalve Cloud")
    y = 0

    def footer():
        pdf.setStrokeColor(BORDER)
        pdf.line(LEFT, 66, RIGHT, 66)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(NAVY)
        pdf.drawString(LEFT, 48, "OCTALVE CLOUD")
        pdf.setFont("Helvetica", 7.5)
        pdf.setFillColor(MUTED)
        pdf.drawString(146, 48, "Billing document, not independent proof of payment")

    def heading(continuation=False):
        nonlocal y
        pdf.setFillColor(BLUE)
        pdf.rect(0, HEIGHT - 9, WIDTH, 9, stroke=0, fill=1)
        try:
            pdf.drawImage(
                ImageReader(BytesIO(document.logo)), LEFT, HEIGHT - 110,
                width=196, height=57, preserveAspectRatio=True,
                anchor="c", mask="auto",
            )
        except (OSError, ValueError) as exc:
            raise ValueError("Approved invoice logo is unavailable") from exc
        pdf.setFillColor(NAVY)
        pdf.setFont("Helvetica-Bold", 22)
        pdf.drawRightString(RIGHT, HEIGHT - 69, "INVOICE")
        pdf.setFont("Helvetica", 8.5)
        pdf.setFillColor(MUTED)
        pdf.drawRightString(RIGHT, HEIGHT - 86, document.invoice_number)
        pdf.setStrokeColor(BORDER)
        pdf.line(LEFT, HEIGHT - 123, RIGHT, HEIGHT - 123)
        y = HEIGHT - 138
        if continuation:
            pdf.setFont("Helvetica", 9)
            pdf.drawString(LEFT, y, "Invoice items (continued)")
            y -= 24

    def ensure(required):
        nonlocal y
        if y - required >= BOTTOM:
            return False
        footer()
        pdf.showPage()
        heading(continuation=True)
        return True

    def info(label, value, x, top):
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 7.5)
        pdf.drawString(x, top, label.upper())
        pdf.setFillColor(NAVY)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(x, top - 17, str(value)[:34])

    heading()

    # Four exact server-owned invoice facts; status is not a payment receipt.
    pdf.setFillColor(PALE)
    pdf.roundRect(LEFT, y - 68, RIGHT - LEFT, 68, 9, fill=1, stroke=0)
    for x in (170, 288, 405):
        pdf.setStrokeColor(BORDER)
        pdf.line(x, y - 53, x, y - 15)
    info("Invoice number", document.invoice_number, LEFT + 12, y - 21)
    info("Issued", document.issue_date, 180, y - 21)
    info("Due", document.due_date, 298, y - 21)
    pdf.setFont("Helvetica", 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(416, y - 21, "STATUS")
    status_colour = GREEN if document.status == "PAID" else RED if document.status in ("UNPAID", "OVERDUE") else BLUE
    pdf.setFillColor(status_colour)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(416, y - 38, document.status)
    y -= 78

    issuer = [document.issuer_name, document.issuer_address, document.issuer_email, document.issuer_tax_id]
    customer = [
        document.recipient_name, document.recipient_company, document.recipient_address,
        document.recipient_location, document.recipient_country,
        document.recipient_email, document.recipient_tax_id,
    ]

    def party_lines(values):
        output = []
        for v in values:
            if v:
                output.extend(_wrap(v, 8, 218))
        return output

    issuer_lines, customer_lines = party_lines(issuer), party_lines(customer)
    maxlines = max(len(issuer_lines), len(customer_lines), 1)
    card_height = max(112, 32 + 12 * maxlines)
    # Refuse to cut legal/customer identity off: unsupported oversized profiles
    # must be handled by a separately qualified multipage invoice template.
    if card_height > 254:
        raise ValueError("Invoice billing identity exceeds template_01 capacity")
    if ensure(card_height + 20):
        pass
    pdf.setFillColor(PALE)
    pdf.roundRect(LEFT, y - card_height, RIGHT - LEFT, card_height, 9, fill=1, stroke=0)
    for x, title, entries in ((LEFT + 12, "ISSUED BY", issuer_lines), (WIDTH / 2 + 9, "BILL TO", customer_lines)):
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(BLUE)
        pdf.drawString(x, y - 20, title)
        for idx, entry in enumerate(entries):
            pdf.setFillColor(NAVY if idx == 0 else INK)
            pdf.setFont("Helvetica-Bold" if idx == 0 else "Helvetica", 8)
            pdf.drawString(x, y - 37 - idx * 12, entry)
    y -= card_height + 14

    def table_header():
        nonlocal y
        if ensure(35):
            pass
        pdf.setFillColor(NAVY)
        pdf.roundRect(LEFT, y - 27, RIGHT - LEFT, 29, 4, stroke=0, fill=1)
        pdf.setFillColor(white)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(LEFT + 12, y - 17, "DESCRIPTION")
        pdf.drawRightString(361, y - 17, "QTY")
        pdf.drawRightString(444, y - 17, "UNIT PRICE")
        pdf.drawRightString(RIGHT - 9, y - 17, "TOTAL")
        y -= 32

    table_header()
    for item in document.lines:
        parts = _wrap(item.description, 8.5, 259) or ["Invoice item"]
        height = max(32, 15 + len(parts) * 12)
        if ensure(height + 8):
            table_header()
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica", 8.5)
        for idx, part in enumerate(parts):
            pdf.drawString(LEFT + 12, y - 14 - idx * 12, part)
        pdf.setFont("Helvetica", 8)
        pdf.drawRightString(361, y - 14, item.quantity)
        pdf.drawRightString(444, y - 14, f"{item.unit_price:,.2f}")
        pdf.drawRightString(RIGHT - 9, y - 14, f"{item.subtotal:,.2f}")
        y -= height
        pdf.setStrokeColor(BORDER)
        pdf.line(LEFT, y, RIGHT, y)
        y -= 3

    # Financial rows are rendered only from persisted, validated totals.
    ensure(170)
    y -= 8
    values = [
        ("Subtotal", document.subtotal),
        ("Discount", document.discount_total),
        ("Tax", document.tax_total),
        ("Total", document.total),
        ("Amount paid", document.amount_paid),
        ("Amount due", document.amount_due),
    ]
    for name, amount in values:
        emph = name in ("Total", "Amount due")
        if emph:
            pdf.setFillColor(PALE)
            pdf.roundRect(304, y - 7, RIGHT - 304, 23, 5, stroke=0, fill=1)
        pdf.setFillColor(BLUE if name == "Amount due" else NAVY)
        pdf.setFont("Helvetica-Bold" if emph else "Helvetica", 9.5)
        pdf.drawString(313, y, name)
        pdf.drawRightString(RIGHT - 8, y, _money(amount, document.currency))
        y -= 22

    # User-provided notes are bounded by the engine. Do not imply payment success.
    note = document.notes or (
        "Payment verification and service activation require confirmed settlement. "
        "This invoice alone is not proof of payment."
    )
    pieces = _wrap(note, 8, RIGHT - LEFT - 28)
    height = max(47, 26 + len(pieces) * 11)
    ensure(height + 16)
    y -= 7
    pdf.setFillColor(PALE)
    pdf.roundRect(LEFT, y - height, RIGHT - LEFT, height, 7, fill=1, stroke=0)
    pdf.setFillColor(BLUE)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(LEFT + 12, y - 17, "Notes")
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    for idx, piece in enumerate(pieces):
        pdf.drawString(LEFT + 12, y - 32 - idx * 11, piece)
    footer()
    pdf.save()
    return stream.getvalue()
