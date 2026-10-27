"""Build a synthetic PDF to visually review Template 01 without DB or payment calls.

Run from the repository root:
  python backend/billing/invoice-template/preview_template_01.py --output /tmp/octalve-invoice-preview.pdf

All entities, prices and addresses are fictional; the preview is NOT billable.
"""
from argparse import ArgumentParser
from decimal import Decimal
from importlib import import_module
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from billing.invoice_pdf import InvoiceDocument, InvoiceLine, TEMPLATE_REGISTRY, _logo


def sample():
    amounts = [Decimal("120000"), Decimal("25000"), Decimal("30000"), Decimal("50000")]
    descriptions = [
        "Business Web Hosting - Annual Plan",
        "Domain Registration - example-business.invalid",
        "SSL Certificate - Standard SSL",
        "Business Email - 5 mailboxes",
    ]
    subtotal = sum(amounts)
    tax = Decimal("16875.00")
    return InvoiceDocument(
        invoice_number="SAMPLE-2026-000128",
        status="UNPAID",
        issue_date="27 Oct 2026",
        due_date="03 Nov 2026",
        currency="NGN",
        issuer_name="Octalve Cloud - EXAMPLE DOCUMENT",
        issuer_address="Seller identity is configured after legal verification.",
        issuer_email="sample@example.invalid",
        issuer_tax_id="",
        recipient_name="Sample Business Ltd",
        recipient_company="Illustrative customer only",
        recipient_address="Example address, Nigeria",
        recipient_location="Example City",
        recipient_country="Nigeria",
        recipient_email="billing@example.invalid",
        recipient_tax_id="",
        lines=tuple(InvoiceLine(description, "1", amount, amount)
                    for description, amount in zip(descriptions, amounts)),
        subtotal=subtotal, discount_total=Decimal("0.00"), tax_total=tax,
        total=subtotal + tax, amount_paid=Decimal("0.00"),
        amount_due=subtotal + tax,
        notes="SAMPLE PREVIEW ONLY - NO PAYMENT IS DUE. This is not an issued invoice, "
              "tax record, or proof of payment. All customer details are fictional.",
        logo=_logo(),
    )


def main():
    parser = ArgumentParser(description="Offline Octalve invoice visual QA fixture.")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = import_module(TEMPLATE_REGISTRY["template_01"]).render(sample())
    if not output.startswith(b"%PDF-"):
        raise ValueError("Renderer did not return PDF")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Do not unexpectedly replace a previously reviewed artifact.
    with args.output.open("xb") as file:
        file.write(output)
    print("Template 01 synthetic preview saved: " + str(args.output.resolve()))


if __name__ == "__main__":
    main()
