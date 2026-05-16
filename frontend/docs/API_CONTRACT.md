# Octalve Console API Contract

## Auth

```txt
POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/logout/
GET  /api/auth/me/
POST /api/auth/password/reset/
```

## Catalog

```txt
GET    /api/products/
POST   /api/products/
GET    /api/products/{id}/
PUT    /api/products/{id}/
GET    /api/plans/
POST   /api/plans/
GET    /api/plans/{id}/
PUT    /api/plans/{id}/
```

## Orders

```txt
GET  /api/orders/
POST /api/orders/
GET  /api/orders/{id}/
POST /api/orders/{id}/approve/
POST /api/orders/{id}/cancel/
```

## Billing

```txt
GET  /api/invoices/
POST /api/invoices/
GET  /api/invoices/{id}/
POST /api/invoices/{id}/pay/
POST /api/invoices/{id}/void/
GET  /api/transactions/
POST /api/transactions/manual/
GET  /api/quotes/
POST /api/quotes/
POST /api/quotes/{id}/convert-to-invoice/
```

## Services

```txt
GET  /api/services/
GET  /api/services/{id}/
POST /api/services/{id}/provision/
POST /api/services/{id}/suspend/
POST /api/services/{id}/unsuspend/
POST /api/services/{id}/terminate/
POST /api/services/{id}/change-package/
GET  /api/services/{id}/usage/
GET  /api/services/{id}/management/
```

## Domains

```txt
GET  /api/domains/
POST /api/domains/check/
POST /api/domains/register/
POST /api/domains/transfer/
GET  /api/domains/{id}/
POST /api/domains/{id}/nameservers/
POST /api/domains/{id}/dns-records/
POST /api/domains/{id}/renew/
```

## Gateways

```txt
GET  /api/gateways/
PUT  /api/gateways/{code}/
POST /api/payments/paystack/initialize/
POST /api/payments/flutterwave/initialize/
POST /api/webhooks/paystack/
POST /api/webhooks/flutterwave/
```

## Wallet

```txt
GET  /api/wallet/
POST /api/wallet/deposit/
GET  /api/wallet/ledger/
POST /api/wallet/apply-to-invoice/
```

## Support

```txt
GET  /api/tickets/
POST /api/tickets/
GET  /api/tickets/{id}/
POST /api/tickets/{id}/reply/
POST /api/tickets/{id}/close/
GET  /api/support/departments/
GET  /api/support/responses/
```

## Settings

```txt
GET /api/settings/
PUT /api/settings/general/
PUT /api/settings/security/
PUT /api/settings/social-login/
PUT /api/settings/tax/
PUT /api/settings/mail/
PUT /api/settings/tickets/
PUT /api/settings/cron/
PUT /api/settings/credits/
PUT /api/settings/theme/
PUT /api/settings/invoices/
GET /api/settings/api-keys/
POST /api/settings/api-keys/
GET /api/settings/notifications/
PUT /api/settings/notifications/{id}/
```

## Audit

```txt
GET /api/audit-logs/
```
