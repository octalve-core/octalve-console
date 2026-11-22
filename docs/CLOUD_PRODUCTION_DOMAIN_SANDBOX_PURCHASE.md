# Production Console sandbox purchase

The existing Production Console and API host this acceptance flow. The test is limited to a single email-verified Client account and exact lowercase .com name. Paystack and the registrar both operate in test mode. There is no database migration.

## Configure

- In Super Admin Integrations, verify a Cloudflare Registrar **Sandbox** connection with a dedicated Registrar Sandbox token. In Gateways, bind the verified Paystack **test** vault connection. Configure the Paystack Test Mode webhook URL to the Production API's `/api/payments/webhook/paystack/`.
- Set `CLOUD_DOMAIN_PILOT_CLIENT_ID` to the approved Client account ID and `CLOUD_DOMAIN_PILOT_NAME` to the exact .com name. Set `CLOUD_DOMAIN_PILOT_REGISTRAR_ID` to the verified sandbox connection UUID.
- Set `CLOUD_DOMAIN_PILOT_CONTACT_JSON` as a protected API environment variable. Its shape is `{"email":"…","phone":"+234.…","postal_info":{"name":"…","address":{"street":"…","city":"…","state":"…","country_code":"NG","postal_code":"…"}}}`.
- Use the existing qualified vault configuration and enable `CLOUD_PAYSTACK_TEST_BINDING_ENABLED`, `CLOUD_HOSTED_CHECKOUT_ENABLED`, `CLOUD_GATEWAY_READBACK_ENABLED` and `CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED`. The existing `CLOUD_PAYMENT_RETURN_URL` must use the Production Console origin. The pilot derives its return path from that URL. Enable `CLOUD_DOMAIN_PILOT_ENABLED=true` when the account, name and providers are ready.
- Set a one-year .com draft rate at **Admin → Settings → Domain TLD pricing**. The protected pilot uses that draft while ordinary domain purchase remains unavailable.

## Accept

1. As the designated Client, open **Domains → Register a domain**. Check sandbox availability, accept the five-minute quote, and pay with Paystack's published test payment details.
2. Use **Confirm payment and registration** after the signed test webhook arrives. Refresh the confirmation if the registrar is still processing. Super Admin can read the same purchase on the Domain TLD pricing page.
3. Verify one order and invoice, a verified test Paystack reference and **Sandbox domain registered** after supplier readback. The invoice is voided after test verification and no live transaction or domain entitlement is posted.
4. After acceptance, disable `CLOUD_DOMAIN_PILOT_ENABLED`. Retain the audit evidence. If the registrar submit timed out, use registrar readback and investigate the attempt before approving any new purchase. The pilot does not submit twice.
