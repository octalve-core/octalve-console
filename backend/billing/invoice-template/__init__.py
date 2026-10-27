"""Version-controlled invoice layouts. No payment state or business logic here.

This folder deliberately uses the requested name invoice-template.
Modules are imported ONLY through billing.invoice_pdf.TEMPLATE_REGISTRY.
Do not accept a template path from query strings, request bodies or metadata.
"""
