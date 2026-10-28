# Octalve Cloud — Batch C Client and public-auth acceptance matrix
Source baseline: `82111e654a6d261ac71dc532fd39bf725b94354b` (includes reviewed global-finance Admin-only security PR #86).

**Truthful scope:** 33 Client plus 7 public/auth routes, **40 routes × 6 widths = 240 cases**; the outstanding Admin/Staff **95 × 6 = 570** cases bring the complete **135 × 6 = 810** release gate. The source-manifest is not evidence of actual browser execution.

Mobile/desktop widths: **320, 360, 390, 768, 1024, 1440 px.** Each case must have real role-correct authentication or documented public access, negative-role check when appropriate, fixture IDs for dynamic segments, a navigable page capture, no horizontal overflow, keyboard focus, navigation, layout, and data truthfulness. Test dialogs, bottom sheets, service ownership, payment return, OPanel launch authorization, loading/empty/error states, and i18n where relevant. No real payments, provisioning or communication should be triggered.

The following source components were migrated in the Batch C review branch: `ClientOverviewMetrics`, `ClientOverviewActions`, `BillingRecordDirectory`, `ClientProfileDetailsForm`, `AuthLayout`; they now use the existing canonical scoped CSS grid and Console icon palette. Their other route-specific DOM and business actions are not thereby certified. All 40 route browser cases remain **pending** until independently attested.

| Role | Source route | Workstream | Browser evidence |
| --- | --- | --- | --- |
| Client | `/client/community` | Client account | Pending six viewports |
| Client | `/client/domains/[id]/dns` | Domains | Pending six viewports |
| Client | `/client/domains/[id]/nameservers` | Domains | Pending six viewports |
| Client | `/client/domains/[id]` | Domains | Pending six viewports |
| Client | `/client/domains/[id]/renewal` | Domains | Pending six viewports |
| Client | `/client/domains` | Domains | Pending six viewports |
| Client | `/client/domains/register` | Domains | Pending six viewports |
| Client | `/client/domains/transfer` | Domains | Pending six viewports |
| Client | `/client/invoices/[id]` | Billing | Pending six viewports |
| Client | `/client/invoices` | Billing | Pending six viewports |
| Client | `/client/knowledge-base/[id]` | Client account | Pending six viewports |
| Client | `/client/knowledge-base` | Client account | Pending six viewports |
| Client | `/client/notifications` | Client account | Pending six viewports |
| Client | `/client/order/checkout` | Checkout | Pending six viewports |
| Client | `/client/order` | Checkout | Pending six viewports |
| Client | `/client/order/processing` | Checkout | Pending six viewports |
| Client | `/client/orders/[id]` | Billing | Pending six viewports |
| Client | `/client/orders` | Billing | Pending six viewports |
| Client | `/client` | Client account | Pending six viewports |
| Client | `/client/payments/return` | Client account | Pending six viewports |
| Client | `/client/profile` | Client account | Pending six viewports |
| Client | `/client/purchases` | Client account | Pending six viewports |
| Client | `/client/rewards` | Client account | Pending six viewports |
| Client | `/client/services/[id]/authorize-opanel` | Services | Pending six viewports |
| Client | `/client/services/[id]/hosting-status` | SSO / hosting | Pending six viewports |
| Client | `/client/services/[id]/opanel` | SSO / hosting | Pending six viewports |
| Client | `/client/services/[id]` | Services | Pending six viewports |
| Client | `/client/services` | Services | Pending six viewports |
| Client | `/client/settings` | Client account | Pending six viewports |
| Client | `/client/support/[id]` | Support | Pending six viewports |
| Client | `/client/support/new` | Support | Pending six viewports |
| Client | `/client/support` | Support | Pending six viewports |
| Client | `/client/wallet` | Client account | Pending six viewports |
| Public/auth | `/forgot-password` | Public/auth | Pending six viewports |
| Public/auth | `/login` | Public/auth | Pending six viewports |
| Public/auth | `/logout` | Public/auth | Pending six viewports |
| Public/auth | `/page.tsx` | Public/auth | Pending six viewports |
| Public/auth | `/reset-password/confirm/[uid]/[token]` | Public/auth | Pending six viewports |
| Public/auth | `/signup` | Public/auth | Pending six viewports |
| Public/auth | `/verify-email` | Public/auth | Pending six viewports |

## Release blockers
- There is **no signed, role-authenticated 810-case browser evidence set** available in the repository or connected deployment. The existing `frontend/scripts/browser-parity-qualification.cjs --plan` generates only a plan; `--verify` needs an actual signed artifact manifest, trusted key, release SHA, screenshot digests, and independent reviewer validation.
- Vercel Production SHA must match an approved, qualified source merge **and** deployed runtime with real browser evidence. No source-only CI pass may claim that.
- Django global-financial visibility was restricted to Admin in PR #86 with isolated negative tests; currency-qualified accounting, provider-confirmed settlement and report export/generation are **not** financially qualified by that fix.
- `frontend/src/app/globals.css` must remain until zero live legacy consumers are shown. On this Batch C branch it remains exactly **8,502 lines** (`9ae994d96118a54fe4e48411f39ec84b541478e3`). Existing `.grid` declarations have other owners; do not delete them.
- Dynamic routes (e.g. `/client/domains/[id]/dns`, `/client/services/[id]/opanel`, `/reset-password/confirm/[uid]/[token]`) need isolated synthetic fixtures. Do not create live orders or connect third-party providers merely to fill screenshots.
