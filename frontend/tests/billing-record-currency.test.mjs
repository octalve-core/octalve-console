import assert from "node:assert/strict";
import test from "node:test";
import {normalizeClientRecord} from "../src/features/client/utils/client-record-normalizer.ts";
import {normalizeAdminRecord} from "../src/features/admin/utils/admin-record-normalizer.ts";

test("billing records format their own currency and preserve missing or unknown amounts", () => {
  const record = {id: 1, total: "120000.00", currency: "NGN"};
  assert.equal(normalizeClientRecord(record, "invoices").amount, "₦120,000.00");
  assert.match(normalizeClientRecord({...record, currency: "eur"}, "orders").amount, /€/);
  assert.match(normalizeAdminRecord(record, "invoices").amount, /₦/);
  assert.equal(normalizeClientRecord({...record, currency: ""}, "invoices").amount, "120000.00");
  assert.equal(normalizeClientRecord({id: 1, currency: "NGN"}, "invoices").amount, "");
});
import {invoicePaymentHref,invoiceCheckoutHref} from "../src/features/client/components/commerce/invoice-links.ts";
import {sanitizeCommerceNext} from "../src/lib/commerce/sanitize-commerce-next.ts";
test("all invoice and order pay links preserve the exact invoice in canonical checkout",()=>{
 const href="/client/order/checkout?view=invoice&invoice=42";
 for(const kind of ["invoice","combined_domain","domain","legacy_domain"])assert.equal(invoicePaymentHref(42,{kind,domain:"fixture.com"}),href);
 assert.equal(invoicePaymentHref(42,null),undefined);
 assert.equal(invoicePaymentHref("../admin",{kind:"invoice"}),undefined);
 assert.equal(invoiceCheckoutHref(0),"/client/invoices");
 assert.equal(normalizeClientRecord({id:42,payment_resume:{kind:"domain",domain:"fixture.com"}},"invoices").paymentHref,href);
 assert.equal(normalizeClientRecord({id:9,invoice_documents:[{id:42,number:"INV42",payment_resume:{kind:"invoice"}}]},"orders").invoiceDocuments[0].paymentHref,href);
 assert.equal(sanitizeCommerceNext(href+"&returning=1"),href+"&returning=1");
 assert.equal(sanitizeCommerceNext(href+"&invoice=43"),"");
 assert.equal(sanitizeCommerceNext(href+"&returning=https://evil.invalid"),"");
});
