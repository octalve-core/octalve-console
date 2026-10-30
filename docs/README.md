# Octalve Cloud — Documentation index and governance

**Audit date:** 30 October 2026. **Live source baseline:** `d7825d7e58ffb36b7105c1ef32e9faa408d2b044`. 
**Current authoritative report:** [End-to-end system audit and gap register](OCTALVE_CLOUD_FULL_SYSTEM_AUDIT_2026-10-30.md).

## Current execution entry points

- [Full current implementation, backend/frontend gaps and prioritized acceptance batches](OCTALVE_CLOUD_FULL_SYSTEM_AUDIT_2026-10-30.md) — read this first.
- [Batch 2 Settings implementation and safe Production migration history](CONSOLE_BATCH2_SETTINGS_RELEASE_GATE_2026-10-30.md). The document contains dated *pre-release* language. Four Settings migrations were subsequently applied to Production and both Vercel aliases deployed; never repeat the migration.
- [Invoice-grade record directory UI-02](UI02_INVOICE_DIRECTORY_ACCEPTANCE_2026-10-29.md) and [customer API UI-03](UI03_CUSTOMER_CONTRACT_QUALIFICATION_2026-10-29.md). Source contracts, **not** authenticated browser acceptance.
- [Customer/Staff/Admin UI-01–03 plan](CONSOLE_INVOICE_UI_MODERNIZATION_BATCHES_2026-10-29.md) and [Batch 1–2 original requirements](CONSOLE_BATCH_1_2_ACCEPTANCE_2026-10-30.md). Approved intent, not current endpoint inventory.
- [Master October 26 execution plan](CLOUD_MASTER_EXECUTION_PLAN_2026-10-26.md), [acceptance matrix](CLOUD_MASTER_ACCEPTANCE_MATRIX_2026-10-26.md), [release runbook](CLOUD_PRODUCTION_RELEASE_RUNBOOK_2026-10-26.md). **Historical snapshots:** no longer valid as direct deployment approvals or live migration counts.

## Document classification

The original Console `docs/` tree had **102 documents**. All paths were inventoried; legacy guides were examined for current correctness and cross-references in the other documents.

| Classification | Original count | Treatment |
|---|---:|---|
| Foundational architecture, standalone reviews | 10 | Preserve architecture/review evidence, not dated operational commands |
| Authentication/security acceptance | 11 | Preserve security decisions and negative-case signoff history |
| Batch/acceptance history | 21 | Preserve point-in-time scope, commit references and no-go conditions |
| Database/release history | 15 | Preserve historical migration and recovery evidence; do not replay |
| Frontend/UI history | 18 | Preserve prior designs, counts and CSS parity decisions as dated |
| Commercial/OPanel history | 5 | Preserve boundary and lifecycle requirements as dated |
| Supplier/security/integration history | 17 | Preserve original audit, key custody and supplier certification gates |
| Truly obsolete, malformed and unreferenced developer guides | 5 | Retire from current working tree; Git history retains them |
| **Total** | **102** | **97 historical/reference files retained** |

### Obsolete documents retired

1. `API_CONTRACT.md` — guessed/legacy endpoints and invalid generic Settings PUT routes.
2. `FRONTEND_BACKEND_HANDOFF.md` — old no-backend handoff and wrong current React/Django module state.
3. `NEXT_PHASE_ROADMAP.md` — generic unqualified MVP phase list superseded by the audit's acceptance gates.
4. `PROJECT_IMPLEMENTATION_GUIDE.md` — obsolete mock-first backend implementation instructions.
5. `BACKEND_TOOLS_KB_CHECKOUT_CONTRACT.md` — malformed 299-byte incomplete skeleton.

The root README and backend README are corrected in this change rather than deleted. **Do not delete old security, financial, release or recovery reports simply because they have older batch numbers.** They are reproducible historical evidence, not current readiness claims.

## Accurate current source of truth

- Console repo `octalve-core/octalve-console`: Django models/views/migrations, Next.js routes, CI, and deployed SHA.
- Public website `octalve-core/octalve-cloud`: separate source/deploy; company Terms/Privacy routes were 404 at this audit and require approved text.
- OPanel `octalve-core/octalve-opanel`: independent hosting management and session/SSO lifecycle; source scaffolding is not live server proof.
- Invoice `octalve-core/octalve-invoice`: design reference only, not authoritative transactions.

Production Neon is at **59 migrations / 111 tables**. Current source includes later provider connection migrations *not yet applied to Production*. Published catalogue offers, visible products/plans and supplier records were all zero in the Production readback. The public storefront returned no plans. The verified source route inventory is **135 pages × six widths = 810 required authenticated cases**, still not executed.

### How to maintain this index

Update the **current audit** on each substantive new release with exact Git commit, DB ledger, live alias SHA, enabled integration claims and browser/vendor receipts. Keep completed batch reports as historical records; write new acceptance docs rather than silently editing evidence. Treat an external provider as operational only after real signed provider receipts, scoped roles, tested rollback and independently observed customer outcome. Changes in this docs-only cleanup require CI; no database, supplier, payment or environment changes are authorized.
