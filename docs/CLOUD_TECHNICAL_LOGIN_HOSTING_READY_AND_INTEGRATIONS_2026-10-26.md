# Octalve Cloud — provisioned technical credentials and customer notification authority
**26 October 2026 · Development accepted in Review only**

## What gets created and what gets emailed

- Console customer login: existing secure account, password/MFA policy, payment and subscription authority.
- Provider server account: one unique hosting username (e.g. eight-character DirectAdmin/WHM username) created only by qualified provider worker after real payment authority. Provider account password is a different technical secret; the existing creation contract does NOT yet implement credential delivery/reset or a real remote-create write.
- OPanel optional technical username: independently generated `op<service-id-in-base36>`; password belongs only to OPanel and is set by the customer **after** they enter through Console SSO. OPanel has no duplicate Console password database. A direct technical login still asks Console for fresh service ownership/active-status/proof before creating a panel session.
- WordPress administrator user/password: separate from all the above, generated/set during a qualified WordPress installation; no production installer exists yet.
- GitHub/Cloudflare authentication: scoped third-party app/zone tokens, never customer passwords emailed to OPanel.

**Notification timing:** customer purchase (invoice), independently verified payment (payment receipt), then separately **provider-confirmed hosting account ready**. A successful payment webhook or paid invoice cannot cause a hosting-ready email before actual provider readback. A hosting-ready email includes nameservers/server identifiers when later proven, real hosting account username, optional technical OPanel username, service URL and safe password-setup instructions. It does NOT include a reusable password. Sending permanent passwords via email creates a recoverable account-takeover risk; OWASP recommends expiring one-time reset/setup links and specifically not emailing the new password.

## Implemented Console code

- `notifications.models.HostingNotice` + `notifications/migrations/0001_hosting_ready_outbox.py`: unique outbox event key, one service, recipient, subject, plain-text body, queue/sent/failed status and attempts. This introduces a **new migration and table** in Review only.
- `notifications.hosting_ready`: deterministic optional OPanel technical name aligned with OPanel's own `technical_username`, domain/package/provider username and renewal date sourced only from active *provider-verified, customer-owned* hosting. Trusted fixed Console HTTPS origin and no browser/customer-provided redirect or password content.
- `queue_hosting_ready(service)`: idempotent queued record; no sending; only when `CLOUD_HOSTING_READY_QUEUE_ENABLED=true` and the service passes `opanel_bridge.policy.eligible`.
- `provisioning.reconcile.reconcile_verified_hosting()`: optionally queues the hosting-ready notice in the same DB transaction AFTER service activation and private readback proof. A missing safe email/callback configuration prevents the transaction when this feature is explicitly enabled.
- `send_hosting_ready()`: always rejected until authenticated transport, bounce, retries, suppression and delivery worker have independent acceptance. Customer messages cannot be claimed sent just because an outbox row exists.
- Existing financial/gateway verification and remote account-creation controls remain default-off in Production. `CLOUD_HOSTING_READY_QUEUE_ENABLED=false` by default.

## Customer journey

```text
Console sign in -> choose hosting package -> invoice unpaid -> verified payment
  -> stage one account -> one provider create attempt -> exact account readback
  -> Console activates hosting service (customer/provider/account validated)
  -> queue ONE hosting-ready notice [NO PASSWORD]
  -> approved email delivery worker (still missing)
  -> customer enters OPanel with Console SSO
  -> optionally sets own OPanel technical password (separate DB)
  -> later choose Console SSO OR OPanel technical sign-in
  -> per-operation OPanel access still requires active Console entitlement
```

## Integrations and runtime authority

WordPress/Softaculous, Cloudflare DNS, GitHub static publishing and future Node/Next.js are OPanel **technical integrations** in the independent repository, not Console identity or billing services. Console retains plan-level provider/package capabilities, domain registrar authority and service ownership. OPanel must check a true vendor-supported runtime/zone/repository per specific service; a cheap static plan cannot claim PHP, WordPress or SSR support.

## Remaining production blockers

1. Real provider server-account creation, safe credential bootstrap and secure customer resets are **not** implemented/qualified.
2. OPanel separate password login: optional implementation with Django hashed passwords, per-service binding, throttles and Console entitlement verification; requires Production-grade MFA/recovery/distributed rate-limit review before enabling.
3. Real email delivery: delivery worker, sender authentication, bounce/unsubscribe status as applicable, backoff, dedup, verification, and secrets never in mail.
4. GitHub integration: selected-repository GitHub App, readonly source access, trust pinned commit and isolated build/publish; Cloudflare zone token scoping and ownership; Softaculous support verified against actual vendor licenses and PHP/SQL hosting capability.
5. Actual public website/WordPress installation, valid DNS/HTTPS and runtime gates still unqualified.
6. Console Review schema migrations must be rechecked with new outbox migration. Do not alter Production without owner approval and a fresh migration/backup preflight.

**Full batch validation:** OPanel `bridge.test_technical_access` and `bridge.test_integrations`, Console `notifications.test_hosting_ready` and `provisioning.test_paid_funnel`, both CI Postgres/frontend suites. Mock fixtures are not proof of live gateway/provider/mail delivery.
