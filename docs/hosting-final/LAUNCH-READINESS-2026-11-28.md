# Octalve Cloud launch readiness — 28 November 2026

Baseline main 999643d540c54d709d28c5b757ed77936fe57241 (HOST-FINAL-02, PR 180), exact source CI 46151526537 and PostgreSQL 46151526451 passed. Both Vercel deployments READY (API dpl_rxzdaU61C3bK1Toz8K8Dp9oqq3UF, Console dpl_Hd11D4PnBW5Qxn7nczd1jXyjEbWf). Official domain health and sign-in smoke passed. Generated deployment hostname rejected by Django ALLOWED_HOSTS; retain canonical allowlist.

Read-only Neon main inventory: one draft test Paystack connection, one test Paystack gateway; draft Cloudflare DNS live, Cloudflare registrar test/live, ResellerClub test. No hosting provider or active hosting service, no transactional email connection, no domain record. No credentials were retrieved or changed.

## Required for hosting-only launch
- Commercial-eligible infrastructure; Linux deployment, HTTPS proxy, durable worker, backup/restore, capacity and monitoring qualification.
- Live Paystack merchant connection, signed webhook and independent exact settlement, late/expired/failed payment and refund/dispute operational path. Sandbox is not live proof.
- Connect restricted cPanel/WHM or DirectAdmin reseller, import and map package/prices, disposable owned-domain hosting order, verified activation, native resource access, valid HTTPS and customer isolation.
- Verified Brevo/Resend sender and DNS, genuine receipt/bounce/suppression acceptance; transactional templates and policy approval.
- Renewal pricing/tax/grace/retention policy, controlled lifecycle and failure recovery, cancellation and independently authorized termination.
- Authenticated production browser acceptance, security and restore drill, launch support/escalation, privacy/terms/refund/SLA policy and go/no-go record.
- Independent OPanel cross-repo acceptance only if offered; native supplier hosting can be the initial scope.

## Other product streams
Registrar launch review is read-only and DomainSearchViewSet check fails closed. Live registration, transfer and renewal supplier automation require implementation and qualification, not merely credentials. Domain sales must not be represented as available until verified. SSL standalone, external email products, other gateways, automatic card debits, WordPress/site deployment and other advertised products need separate capability/fulfillment evidence before sale. No claim of whole-repository exhaustive acceptance.

## This follow-up
Adds portable usage lane and legacy mutual exclusion, truthful disabled worker heartbeat, malformed lease hold, stale transactional notice review and tests. Existing commercial activation and MFA policies unchanged. Temporary Vercel schedule remains daily; no billing or credential changes. See the PR and exact CI evidence for release status.
