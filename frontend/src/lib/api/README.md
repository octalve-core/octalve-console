# Octalve Console API Layer

This folder now has two layers.

## 1. Legacy compatibility layer

endpoints.ts

Current pages may still import from this file. Do not remove it yet.

## 2. OpenAPI-aligned module layer

schema-api.ts
modules/*.api.ts
paths.ts

New frontend work should use the module layer.

Example:

import { schemaApi } from "@/lib/api/schema-api";

const invoices = await schemaApi.billing.invoices();

Or import a focused module:

import { billingApi } from "@/lib/api/modules/billing.api";

const invoice = await billingApi.invoice("123");

## Why this structure exists

- Easier to edit
- Easier to grow
- Easier to align with schema.yml
- Easier to connect Django backend endpoints
- Safer migration because old pages are not broken at once
