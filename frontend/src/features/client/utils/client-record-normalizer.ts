import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import {normalizeServiceSnapshot} from "./service-contract";

export function unwrapClientList(value: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object" && "results" in value
      ? (value as { results: unknown }).results
      : null;
  // A malformed API response must not masquerade as an empty customer/staff account.
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Invalid authorized API list response.");
  }
  return rows as Record<string, unknown>[];
}

export function readClientString(item: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = item[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

export function getClientResourceBasePath(resource: ClientResourceKey) {
  const routeMap: Record<ClientResourceKey, string> = {
    services: "/client/services",
    domains: "/client/domains",
    invoices: "/client/invoices",
    orders: "/client/orders",
    support: "/client/support",
  };

  return routeMap[resource];
}

export function normalizeClientRecord(item: unknown, resource: ClientResourceKey): ClientRecord {
  const record = item as Record<string, unknown>;

  const id = readClientString(record, ["id", "uuid", "reference", "code"], "");
  if (!id) throw new Error("Account record is missing its identifier.");
  const title = readClientString(
    record,
    ["domain_name", "name", "title", "domain", "label", "subject", "invoice_number", "order_number", "product"],
    id,
  );
  const subtitle = readClientString(
    record,
    ["product_name", "plan_name", "service_type", "email", "summary", "description", "package", "product", "department", "client", "customer"],
    resource,
  );
  const meta = readClientString(
    record,
    ["invoice_number", "order_number", "ticket_number", "reference", "domain_name", "type", "cycle", "adapter", "registrar", "priority", "term"],
    "—",
  );
  const amount = readClientString(record, ["total", "price", "amount", "balance", "due", "paid"], "");
  const status = readClientString(record, ["status", "state", "payment_status"], "Unknown");
  const date = readClientString(record, ["expiry_date", "expiration_date", "next_due_date", "due_date", "date", "created_at", "updated_at", "dueDate", "expiry", "renews"], "");

  return {
    id,
    title,
    subtitle,
    meta,
    amount,
    status,
    date,
    actionHref: `${getClientResourceBasePath(resource)}/${encodeURIComponent(id)}`,
    score: undefined,
    service: resource === "services" ? normalizeServiceSnapshot(record) : undefined,
  };
}