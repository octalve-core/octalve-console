"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const view=read("../backend/billing/views.py");
const model=read("../backend/billing/models.py");
const tests=read("../backend/billing/tests.py");
const pdf=read("../backend/billing/invoice_pdf.py");
const page=read("src/app/admin/invoice-designer/page.tsx");
const studio=read("src/features/admin/invoice-studio/AdminInvoiceTemplateStudio.tsx");
for(const method of ["create","update","partial_update","destroy"])
 assert.ok(view.includes("def "+method+"(self, request, *args, **kwargs):\n        return self._financial_write_closed()"),"Generic invoice writes must be blocked: "+method);
assert.ok(model.includes('raise ValueError("Quote conversion requires approved server-priced checkout")'));
assert.ok(view.includes('url_path="templates"')&&view.includes('url_path="template-preview"'));
assert.ok(view.includes('self._require_admin(request)'));
assert.ok(view.includes('preview_template_01'));
assert.ok(pdf.includes("TEMPLATE_REGISTRY")&&pdf.includes('billing.invoice-template.template_01'));
assert.ok(page.includes("AdminInvoiceTemplateStudio"));
assert.ok(studio.includes('api.get<Catalogue>("/billing/invoices/templates/")'));
assert.ok(studio.includes('"/api/cloud"'));
assert.ok(studio.includes('preview_path==="/billing/invoices/template-preview/?template_id=template_01"'));
assert.ok(studio.includes('rel="noopener noreferrer"'));
for(const token of ["test_admin_invoice_write_cannot_fake_paid_or_change_totals","test_template_catalog_admin_only_and_sample_pdf_no_customer_data","test_private_quote_conversion_still_requires_server_requote"])
 assert.ok(tests.includes(token),"Billing acceptance missing "+token);
console.log("PASS: Batch 16 Admin template readback, immutable billing authority and synthetic PDF preview contract");
