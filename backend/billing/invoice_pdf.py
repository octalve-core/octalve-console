"""Simple bounded invoice PDF with server-owned paid/unpaid status and contact.

Avoid HTML rendering, external font fetches, and user-controlled PDF markup.
"""
from io import BytesIO
from decimal import Decimal
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

BLUE = HexColor("#0064E0")
INK = HexColor("#172C44")
GREY = HexColor("#56667A")


def _clean(value, limit=240):
    return "".join(
        char for char in str(value or "")[:limit]
        if 32 <= ord(char) <= 126
    )


def render_invoice_pdf(invoice):
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(595.28, 841.89), pageCompression=1)
    pdf.setTitle("Octalve Cloud Invoice " + _clean(invoice.invoice_number, 40))
    pdf.setAuthor("Octalve Cloud")
    y = 789

    def new_page():
        nonlocal y
        pdf.showPage()
        y = 789

    def line(value, size=10, strong=False, colour=INK):
        nonlocal y
        if y < 75:
            new_page()
        pdf.setFillColor(colour)
        pdf.setFont("Helvetica-Bold" if strong else "Helvetica", size)
        for row in simpleSplit(_clean(value), "Helvetica", size, 480):
            if y < 75:
                new_page()
                pdf.setFont("Helvetica-Bold" if strong else "Helvetica", size)
                pdf.setFillColor(colour)
            pdf.drawString(55, y, row)
            y -= size + 8
        y -= 2

    line("OCTALVE CLOUD", 19, True, BLUE)
    line("Invoice " + _clean(invoice.invoice_number, 60), 14, True)
    line("Status: " + _clean(invoice.status).upper(), 11, True)
    line("Issued: " + invoice.issue_date.date().isoformat())
    line("Due: " + invoice.due_date.date().isoformat())
    y -= 12
    line("BILL TO", 10, True, BLUE)
    snapshot = invoice.metadata.get("billing_contact", {}) if isinstance(invoice.metadata, dict) else {}
    if not isinstance(snapshot, dict):
        snapshot = {}
    for key in ["full_name", "company_name", "email", "phone_number",
                "address", "city", "state", "postal_code", "country", "tax_id"]:
        val = snapshot.get(key)
        if val:
            line(val, 9)
    if not snapshot:
        line(invoice.client.email, 9)
    y -= 12
    line("ITEMS", 10, True, BLUE)
    for item in invoice.items.all().order_by("pk")[:75]:
        line(_clean(item.description, 200), 9, True)
        line(
            f"Quantity {item.quantity} | Unit {item.unit_price} | "
            f"Subtotal {item.subtotal} {invoice.currency}", 9, colour=GREY)
    y -= 12
    line("Subtotal: " + str(invoice.subtotal) + " " + invoice.currency, 10)
    line("Discount: " + str(invoice.discount_total) + " " + invoice.currency, 10)
    line("Tax: " + str(invoice.tax_total) + " " + invoice.currency, 10)
    line("Total: " + str(invoice.total) + " " + invoice.currency, 12, True)
    line("Paid: " + str(invoice.amount_paid) + " " + invoice.currency, 10)
    line("Amount due: " + str(invoice.amount_due) + " " + invoice.currency, 12, True, BLUE)
    y -= 10
    line("Payment status is determined by verified Octalve Cloud records.", 9, colour=GREY)
    line("An unpaid invoice is not proof of payment or active hosting.", 9, colour=GREY)
    pdf.save()
    return stream.getvalue()
