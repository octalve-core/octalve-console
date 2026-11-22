# Production Console sandbox purchase

The existing Production Console and API host this acceptance flow. The test is limited to a single email-verified Client account and exact lowercase .com name. Paystack and the registrar both operate in test mode. There is no database migration.

## Configure

- In Super Admin Integrations, verify a Cloudflare Registrar **Sandbox** connection with a dedicated Registrar Sandbox token. In Gateways, bind the verified Paystack **test** vault connection. Configure the Paystack Test Mode webhook URL to the Production API's `/api/payments/webhook/paystack/`.
- Set `CLOUD_DOMAIN_PILOT_CLIENT_ID` to the approved Client account ID and `CLOUD_DOMAIN_PILOT_NAME` to the exact .com name. Set `CLOUD_DOMAIN_PILOT_REGISTRAR_ID` to the verified sandbox connection UUID.
- Set `CLOUD_DOMAIN_PILOT_CONTACT_JSON` as a protected API environment variable. Its shape is `{"email":"…","phone":"+234.…","postal_info":{"name":"…","address":{"street":"…","city":"…","state":"…","country_code":"NG","postal_code":"…"}}}`.
- Use the existing qualified vault configuration and enable `CLOUD_PAYSTACK_TEST_BINDING_ENABLED`, `CLOUD_HOSTED_CHECKOUT_ENABLED`, `CLOUD_GATEWAY_READBACK_ENABLED` and `CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED`. The existing `CLOUD_PAYMENT_RETURN_URL` must use the Production Console origin. The pilot derives its return path from that URL. Enable `CLOUD_DOMAIN_PILOT_ENABLED=true` when the account, name and providers are ready.
- Set a one-year .com draft rate at **Admin → Settings → Domain TLD pricing**. The protected pilot uses that draft while ordinary domain purchase remains unavailable.

## Accept

1. In **Admin → Settings → Domain TLD pricing**, confirm that the Console preflight passes. This checks local readiness, including vault evidence and runtime flags. In Paystack, verify the Test Mode webhook URL separately.
2. As the designated Client, open **Domains → Register a domain**. Check sandbox availability, accept the five-minute quote, and pay with Paystack's published test payment details.
3. Use **Check existing Paystack reference** to verify the original test payment and reconcile the signed webhook. Then use **Check registrar status** if Cloudflare is still processing. Super Admin can read the same purchase on the Domain TLD pricing page.
4. Verify one order and invoice, a verified test Paystack reference and **Sandbox domain registered** after supplier readback. The invoice is voided after test verification and no live transaction or domain entitlement is posted.
5. After acceptance, disable `CLOUD_DOMAIN_PILOT_ENABLED`. Retain the audit evidence. If the registrar submit timed out, use registrar readback and investigate the attempt before approving any new purchase. The pilot does not submit twice.


## Recovery

- A valid existing hosted checkout can be resumed. If it expired or initialization was interrupted, check the displayed reference. A late Paystack success can still be reconciled when the amount, currency, test mode and signed event agree. If Paystack returns a failed or abandoned payment, retain that reference for operator resolution. The Console does not create a replacement attempt.
- **Registrar response unconfirmed** means the submit could not be confirmed. **Registration pending** means the registrar reported progress or its active record is not yet confirmed. Use **Check registrar status** to read the workflow.
- **Registrar rejected** means Cloudflare returned a terminal failed workflow. **Check Cloudflare for the required action** means Cloudflare paused the workflow for operator action. Inspect the sandbox dashboard before proceeding. Checking status does not send another registration request.
