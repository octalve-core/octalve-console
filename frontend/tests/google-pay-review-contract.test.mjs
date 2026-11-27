import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const button=readFileSync(
  new URL("../src/features/client/components/commerce/GooglePayReviewButton.tsx",import.meta.url),
  "utf8",
);
const processing=readFileSync(
  new URL("../src/features/client/views/ClientProcessingView.tsx",import.meta.url),
  "utf8",
);
const endpoints=readFileSync(
  new URL("../src/lib/api/endpoints.ts",import.meta.url),
  "utf8",
);

test("Google Pay review uses only Google's official SDK and TEST environment",()=>{
  assert.match(button,/https:\/\/pay\.google\.com\/gp\/p\/js\/pay\.js/);
  assert.match(button,/PaymentsClient\(\{environment:"TEST"\}\)/);
  assert.match(button,/createButton\(/);
  assert.match(button,/loadPaymentData\(/);
  assert.doesNotMatch(button,/environment:"PRODUCTION"/);
  assert.doesNotMatch(button,/console\.(?:log|info|debug|warn|error)\(/);
});

test("Google Pay review never posts or persists paymentData",()=>{
  assert.doesNotMatch(button,/fetch\(/);
  assert.doesNotMatch(button,/localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(button,/paymentData\s*[:=]/);
  assert.match(button,/await client\.loadPaymentData\(/);
  assert.match(button,/No payment was charged/);
});

test("Google Pay review is attached only after an unpaid invoice exists",()=>{
  assert.match(processing,/invoiceId&&invoice\?\.status==="unpaid"/);
  assert.match(processing,/GooglePayReviewButton invoiceId=\{invoice.id\}/);
  assert.doesNotMatch(
    readFileSync(new URL("../src/features/client/checkout/ServiceCheckout.tsx",import.meta.url),"utf8"),
    /GooglePayReviewButton/,
  );
});

test("frontend gets Google Pay configuration only from authenticated backend API",()=>{
  assert.match(endpoints,/googlePayReviewConfig\(invoiceId:number\)/);
  assert.match(endpoints,/\/payments\/google-pay\/review-config\//);
  assert.match(endpoints,/charge_enabled:false/);
});
