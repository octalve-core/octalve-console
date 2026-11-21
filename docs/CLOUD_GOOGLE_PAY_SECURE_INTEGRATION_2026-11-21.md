# Octalve Cloud — Secure Google Pay integration plan and review implementation

**Date:** 21 November 2026  
**Status:** Review-only implementation. No Google Pay charge path is enabled.

## Decision

Google Pay is a payment authorization surface, not a new Octalve financial authority.

Octalve Console remains authoritative for:

- product/offer revision and price;
- customer ownership;
- order and invoice creation;
- payment intent/reference;
- exact amount and currency;
- independent Paystack readback;
- atomic settlement;
- provisioning eligibility.

A browser callback, Google Pay sheet success, Paystack redirect or wallet token MUST NOT
mark an invoice paid or provision a service.

## Processor

Use Paystack as the Google Pay gateway.

Google Pay & Wallet Console integration type: **WEB → GATEWAY**.

Do not choose Google's Direct integration. Direct handling would introduce additional PCI
scope and is unnecessary because Paystack is a participating payment gateway.

## Octalve Cloud web domain

The Google Pay API must be approved for the exact fully-qualified origin that renders the
button. Octalve Cloud customer checkout currently belongs to the Console application.

Target registration before production review:

`console.cloud.octalve.com`

Verify the live production alias again immediately before submitting the Google review.
Do not register only `cloud.octalve.com` if the Google Pay API is called from the Console
subdomain.

## Current Paystack support and important limitation

Paystack's current Google Pay developer guide documents Nigerian merchant support and two
authorization methods:

- `CRYPTOGRAM_3DS`
- `PAN_ONLY`

It explicitly states that cards issued in Nigeria use `PAN_ONLY`.

Paystack's mounted `paymentRequest()` button on the merchant's own domain supports only
`CRYPTOGRAM_3DS`. Therefore it is not sufficient as Octalve Cloud's primary Nigerian
Google Pay implementation.

The custom Google Pay SDK path supports both methods and is the target production design.

### Unresolved Paystack contract

Paystack's custom Google Pay guide says `POST /googlepay/charge` requires a Paystack
**transaction ID from Initialize Transaction**. The public Initialize Transaction response
documentation describes `authorization_url`, `access_code` and `reference`, but does
not document that transaction ID in the response.

We will not infer or scrape an undocumented identifier.

Production Google Pay charging remains OFF until Paystack confirms:

1. how the required transaction ID is obtained from a server-initialized transaction;
2. the exact TEST contract for `PAN_ONLY` 3DS;
3. the allowed host/origin pattern for `data.otpmessage`;
4. the Pusher `3DS_<transactionId>` / `response` contract;
5. account eligibility and activation for this Paystack Nigeria business.

## Review-only implementation in this branch

Default-off backend settings:

```env
CLOUD_GOOGLE_PAY_REVIEW_ENABLED=false
CLOUD_GOOGLE_PAY_CHARGE_ENABLED=false
CLOUD_GOOGLE_PAY_MERCHANT_ID=
CLOUD_GOOGLE_PAY_MERCHANT_NAME=
CLOUD_PAYSTACK_INTEGRATION_ID=
```

The review endpoint returns only non-secret values for an exact authenticated,
client-owned, unpaid NGN invoice.

It cannot:

- create a PaymentIntent;
- initialize Paystack;
- submit a Google payment token;
- mark an invoice paid;
- create a Transaction;
- invoke settlement;
- stage or run provisioning.

The frontend loads Google's fixed SDK URL and uses:

- Google environment: `TEST`;
- gateway: `paystack`;
- both `CRYPTOGRAM_3DS` and `PAN_ONLY`;
- VISA and MASTERCARD;
- full billing address;
- assurance details;
- exact server-read invoice amount.

The TEST `paymentData` response is deliberately discarded. It is not logged, stored,
sent to Octalve, or sent to Paystack.

## Google Pay & Wallet Console steps

1. Complete the Octalve business profile.
2. Open **Google Pay API → Integrations**.
3. Choose **Web**.
4. Add the exact checkout domain: `console.cloud.octalve.com`.
5. Select **Gateway** integration.
6. Use Paystack as the payment gateway.
7. Deploy the review-only TEST integration to the approved review origin.
8. Capture the screenshots Google requests using Google's official rendered button/sheet.
9. Submit the website integration for approval.
10. After approval, record the Google Merchant ID in the protected deployment
    configuration as `CLOUD_GOOGLE_PAY_MERCHANT_ID`.

The merchant ID is not a secret, but deployment configuration remains the preferred source
of truth rather than hard-coding it.

## Paystack integration ID

`CLOUD_PAYSTACK_INTEGRATION_ID` is the Paystack Business/Integration ID used as
Google Pay's `gatewayMerchantId`.

It is NOT:

- the Paystack secret key;
- the Paystack public key;
- a transaction reference;
- a Google merchant ID.

Paystack currently documents the Business ID as the unique number shown under the
business name in the Paystack Dashboard.

## Production target design

After Paystack resolves the transaction-ID contract:

1. Customer creates/reviews the Octalve order.
2. Console creates the immutable unpaid invoice.
3. Backend reserves one PaymentIntent/reference under row/transaction authority.
4. Backend initializes the exact Paystack transaction server-side.
5. Frontend requests Google Pay data for the exact server invoice amount.
6. Frontend sends the full paymentData over authenticated HTTPS to a narrow Octalve
   Google Pay charge endpoint.
7. The backend forwards it to Paystack using the server-only secret.
8. Full Google paymentData is never stored in logs or the database.
9. If Paystack returns `auth`, Octalve renders only a provider-validated 3DS origin and
   waits for the documented provider result.
10. Browser result remains advisory.
11. Existing independent Paystack readback verifies reference, amount, currency and
    provider transaction identity.
12. Existing atomic settlement remains the ONLY writer of paid financial state.
13. Only verified paid state can stage provisioning.

Hosted Paystack checkout remains available as fallback.

## Octalve platform scaling

For Octalve-owned products, a Google merchant ID may be reused across approved Octalve
domains while each calling domain is registered.

Do not manually onboard hundreds of future customer custom domains.

Google's **Payments Merchant API** is designed for platforms and can programmatically:

- create merchant records;
- record Google Pay terms acceptance;
- enable merchants;
- register web domains.

When Octalve Cloud begins serving Google Pay buttons on third-party merchant domains,
start the platform onboarding project with Google and obtain Payments Merchant API
production access. Keep that platform layer separate from Console's financial settlement
authority.

## Release gates before any real charge

- Google approves the exact production web domain.
- Paystack enables Google Pay for this business/integration.
- Paystack answers the unresolved transaction-ID and PAN_ONLY/3DS questions.
- Google Merchant ID and Paystack Integration ID are verified.
- TEST `PAN_ONLY` and `CRYPTOGRAM_3DS` flows pass.
- Negative tests: wrong amount, wrong currency, wrong invoice owner, reused reference,
  duplicate callback, forged browser success, malformed paymentData, malicious 3DS URL,
  expired intent, and replay.
- Existing Paystack readback and settlement tests remain green.
- No real-money test is required merely to prove browser rendering.
