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