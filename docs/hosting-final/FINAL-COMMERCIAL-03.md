# Commercial lifecycle follow-up — PR 186

Base: merged PR 185. All existing activation gates are preserved. No schema migration or real supplier/payment transaction is needed for this release.

## Implementation
- ResellerClub v2 live and test authentication use separate fixed origins and the existing encrypted Integration Store credential version. Administrator MFA authorizes a dedicated live account, initial nameservers and supplier-bound TLD rate publication.
- Standard one-year .com/.net registration uses independently settled invoices, staged customer/contact creation and exact supplier account/resource readback. Uncertain mutations are never blindly reissued.
- ResellerClub owner-authorized nameserver updates, registrant verification readback/resend, transfer-in with encrypted EPP, transfer-out code retrieval, and one-year renewal invoices with payment-triggered dispatch. Automatic renewal means invoice generation, not an unapproved automatic card charge. Provider-specific locks or OTP requirements must be qualified against the live account.
- Mixed baskets support multiple standard domains plus published shared/WordPress hosting; one signed basket, one invoice, per-line fulfillment proof. No unsupported premium, VPS, SSL or email bundle is newly authorized.
- Unpaid local claims without ANY payment intent or transaction are released atomically after 24 hours. The invoice is void, order cancelled, and audit receipt survives. Any attempted payment, provider claim, linked resource or inconsistent authority remains held.
- Business intelligence separates gross receipts, verified refunds and net collections; not a bank reconciliation, accounting profit or full expense ledger. Superadmin MFA closure independently checks refund/dispute evidence and retains fulfillment holds where money was returned. Money-moving disputes need further financial review.

## Qualification
Official references: https://developer.resellerclub.com/documentation/quickstart ; https://developer.resellerclub.com/domains/2.0.0/schema.json ; https://developer.resellerclub.com/customers/2.0.0/schema.json ; https://developer.resellerclub.com/contacts/2.0.0/schema.json .
Credentials, provider account funding, published rates, provider-specific commercial agreements, worker cadence and controlled live acceptance remain mandatory. Credential rotation currently requires reviewed reauthorization of affected resources. Do not treat fixture-based CI as live supplier acceptance. No live provider purchase, transfer, renewal or refund was initiated by this release.
