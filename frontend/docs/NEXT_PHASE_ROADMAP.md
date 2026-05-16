# Next Phase Roadmap

## Phase 1 — Make the interface production-connected

- Build Django auth and session/JWT flow.
- Connect frontend login/signup to real backend.
- Replace mock data with API calls.
- Add loading, empty, error and permission states.

## Phase 2 — Billing engine

- Customer model.
- Invoice model.
- Invoice item model.
- Transaction model.
- Quote model.
- Tax engine.
- Credit/wallet ledger.
- Cron-generated renewals.

## Phase 3 — Gateway engine

- Paystack initialize/verify/webhook.
- Flutterwave initialize/verify/webhook.
- Manual bank transfer confirmation.
- Wallet payment.
- Crypto payment placeholder or integration.

## Phase 4 — DirectAdmin automation

- Provider settings.
- Package mapping.
- Test connection.
- Provision shared hosting account.
- Suspend/unsuspend/terminate.
- Fetch usage.
- Log every API request.

## Phase 5 — Domain automation

- Registrar adapter.
- TLD pricing.
- Domain search.
- Registration/transfer/renewal.
- Nameserver management.
- DNS management through Cloudflare adapter.

## Phase 6 — Client management depth

- Customer profile timeline.
- Services and domains per customer.
- Payment and invoice history.
- Ticket history.
- Admin notes.
- Fraud/security flags.

## Phase 7 — Staff operations

- Staff roles and permissions.
- Ticket assignment.
- Provisioning approval queue.
- Audit detail screen.
- Internal comments.

## Phase 8 — Production hardening

- Background worker.
- Redis queue.
- Retry policies.
- Secret encryption.
- Webhook signing verification.
- Rate limiting.
- Error tracking.
- Backups.
