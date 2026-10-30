# Octalve Cloud Django API — Current status

This directory contains an **implemented and deployed Django REST API**, not a future backend skeleton. The frontend lives under `frontend/`. Refer to the current [full-system audit](../docs/OCTALVE_CLOUD_FULL_SYSTEM_AUDIT_2026-10-30.md) and [documentation index](../docs/README.md) before changing contracts.

## Implemented Django applications

`accounts`, `rbac`, `catalog`, `orders`, `billing`, `payments`, `wallet`, `services`, `domains`, `providers`, `provisioning`, `opanel_bridge`, `support`, `knowledge_base`, `settings_registry`, `notifications`, `reports`, `audit` and `rewards`.

Existing source has role protection, customer account management, versioned catalogue, invoice/PDF, gateway/settlement gates, protected wallet ledger, provider draft authority, separate OPanel entitlement, Settings, outbox, reports and support. **Implementation does not imply live supplier/payment/mail certification.**

## Current verified Production baseline — 30 October 2026

The Production API is READY at `api.cloud.octalve.com`. Neon has **59 applied migrations and 111 tables**, including the four Batch 2 Settings migrations. Production does **not** yet contain the newer provider integration-connection vault tables that exist in source; keep supplier credential writes disabled and qualify any further migrations separately.

The published catalogue and supplier inventory are empty in Production. Paystack/Flutterwave settlement, external provisioning, domain registration, wallet funding, Brevo/Resend live delivery, social OAuth and rewards require separate evidence-backed release gates.

## Local and CI

Use Python 3.12 with **pinned** `backend/requirements.txt`, reviewed environment settings and a **disposable** database for tests. Checks include `python manage.py check`, `python manage.py makemigrations --check --dry-run`, Django security/business regression tests and PostgreSQL CI.

Do not run unscoped migrations on Production, import live secrets into tests, or infer vendor operations from green CI. Release procedures and exact acceptance criteria are in the [full-system audit](../docs/OCTALVE_CLOUD_FULL_SYSTEM_AUDIT_2026-10-30.md).
