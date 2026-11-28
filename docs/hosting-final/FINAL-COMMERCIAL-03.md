# Commercial lifecycle follow-up

Base: merged PR #185. This release increment preserves all existing feature gates.

- ResellerClub v2 live and test authentication use separate fixed origins and the same encrypted Integration Store credential version. Readback does not grant execution.
- Abandoned Cloudflare local claims without ANY payment intent or transaction are released after 24 hours. The invoice becomes void, order cancelled, and an audit receipt survives. Any attempted payment, provider claim, linked resource or inconsistent authority remains held.
- Business intelligence separates gross receipts, independently verified refund receipts and net collections, without suggesting bank settlement or profit.

Official reference: https://developer.resellerclub.com/documentation/quickstart ; https://developer.resellerclub.com/domains/2.0.0/schema.json ; https://developer.resellerclub.com/customers/2.0.0/schema.json ; https://developer.resellerclub.com/contacts/2.0.0/schema.json .

Actual supplier execution and mixed checkout need full cross-provider order/customer/contact and financial qualification; do not mark credentials as commercial execution.
