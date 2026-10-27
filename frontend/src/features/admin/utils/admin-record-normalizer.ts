import type { AdminResourceKey } from "../data/admin-resource-config";
import type { AdminRecord } from "../data/admin-demo-data";

export function unwrapAdminList(value: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object" && "results" in value
      ? (value as { results: unknown }).results
      : null;

  // An unexpected response is a load failure, never an empty authorized collection.
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Invalid authorized API list response.");
  }
  return rows as Record<string, unknown>[];
}

export function getAdminRecordId(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid API record.");
  }
  const record = value as Record<string, unknown>;
  for (const key of ["id", "uuid", "reference", "code"]) {
    const id = record[key];
    if ((typeof id === "string" && id.trim()) ||
        (typeof id === "number" && Number.isFinite(id))) {
      return String(id).trim();
    }
  }
  // Never invent a link or use a random ID for an unauthorized / malformed record.
  throw new Error("API record has no stable identifier.");
}

export function findExactAdminRecord(rows: Record<string, unknown>[], id: string) {
  if (!id) return null;
  const matches = rows.filter(row => getAdminRecordId(row) === id);
  if (matches.length > 1) throw new Error("Ambiguous API record identifier.");
  return matches[0] ?? null;
}

export function readAdminString(item: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = item[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

export function getAdminResourceBasePath(configKey: AdminResourceKey) {
  const routeMap: Record<AdminResourceKey, string> = {
    customers: "/admin/customers",
    products: "/admin/products",
    plans: "/admin/plans",
    orders: "/admin/orders",
    invoices: "/admin/billing/invoices",
    domains: "/admin/billing/domains",
    gateways: "/admin/gateways",
    providers: "/admin/servers",
    provisioning: "/admin/provisioning",
  };

  return routeMap[configKey];
}

export function normalizeAdminRecord(item: unknown, configKey: AdminResourceKey): AdminRecord {
  const record = item as Record<string, unknown>;

  const id = getAdminRecordId(record);
  const title = readAdminString(record, ["name", "title", "domain", "display_name", "customer", "client", "email"], id);
  const subtitle = readAdminString(
    record,
    ["email", "summary", "description", "product", "category", "adapter_type", "domain", "subject"],
    configKey,
  );
  const meta = readAdminString(
    record,
    ["status", "type", "cycle", "adapter", "registrar", "provider", "department"],
    "API record",
  );
  const amount = readAdminString(record, ["total", "price", "amount", "balance", "credited"], "");
  const status = readAdminString(record, ["status", "state", "payment_status"], "Unknown");
  const date = readAdminString(record, ["date", "created_at", "updated_at", "dueDate", "expiry"], "");

  return {
    id,
    title,
    subtitle,
    meta,
    amount,
    status,
    date,
    actionHref: `${getAdminResourceBasePath(configKey)}/${encodeURIComponent(id)}`,
  };
}