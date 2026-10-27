# Octalve Cloud — invoice-template

Each invoice design is isolated here. The approved first design is `template_01.py`.

## Boundaries

- `billing/invoice_pdf.py` owns data collection, issuer fields, bounded validation, template ID allowlisting and the public `render_invoice_pdf(invoice)` compatibility contract.
- `invoice-template/template_01.py` owns **only** PDF typography, spacing, pagination, style, approved PNG placement and labels. It takes an immutable `InvoiceDocument` and returns PDF bytes.
- The existing `InvoiceViewSet.download_pdf` owns authenticated client isolation, filename and no-cache response. No new checkout or billing model.
- No client-selected template ID or dynamic module path. The fixed registry selects a reviewed module. An unsupported ID is an error, not an unbranded fallback.
- The source logo stays server-bundled in `billing/assets/octalve-cloud-logo.png.b64` so PDFs never rely on a network lookup.

## Add Template 02 later

1. Copy `template_01.py` to `template_02.py` in this same folder.
2. Change only its renderer and visual constants. No ORM, role, pricing or payment edits.
3. Add the fixed `template_02` module path to `TEMPLATE_REGISTRY` in `billing/invoice_pdf.py`.
4. Introduce an authorized, reviewed issuance-time selection flow with a **pinned template version and immutable document snapshot**, then add tests for existing invoices, owner isolation, historical fidelity, multi-page PDFs and totals. A future Admin Invoice Designer must be server-approved and unable to alter settled financial facts.

Existing invoices lacking a pinned template use `template_01`. Changing a template's code would therefore change the PDF appearance of earlier unpinned invoices; **do not change issued invoice layout in Production without implementing the versioned immutable document snapshot in Batch 16**. Before that batch, new layouts must be additive (new ID), not modifications of Template 01.

The design preview approved in chat is an illustrative mockup with synthetic company data. Actual PDF seller identity fields must be configured/verified; the renderer never invents RC/TIN, tax clearance, IRN, fiscal QR or payment proof.

No migrations or changes to Production payment, provisioning, Rewards or registrar gates are part of this refactor.

## Verify the real PDF layout without a database

From the Octalve Console repository root, with the local Octalve Python virtualenv:

```powershell
& "$HOME\.venvs\octalve-console\Scripts\python.exe" "backend\billing\invoice-template\preview_template_01.py" --output "$HOME\Downloads\octalve-invoice-template-01-preview.pdf"
& "$HOME\.venvs\octalve-console\Scripts\python.exe" "backend\billing\invoice-template\preview_template_01.py" --long --output "$HOME\Downloads\octalve-invoice-template-01-long-preview.pdf"
```

These PDFs are marked synthetic through their SAMPLE invoice number, sample contact data and nonpayment notice. They do not connect to the database, send invoices or change payment state. The output fails if a PDF with the exact filename already exists, to prevent an accidental overwrite. Use a new output filename for another review.

Review the actual generated pages at print size. The Review CI also uploads both sample PDFs as the `octalve-invoice-template-01-visual-review` artifact, available on the exact-head GitHub Actions run.

Once issued, an invoice stores an allowlisted `invoice_template_id` under its existing metadata. Older invoices without an ID use Template 01. There is no new migration.
