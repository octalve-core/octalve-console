import type { AdminResourceKey } from "../data/admin-resource-config";
import type { AdminRecord } from "../data/admin-demo-data";

export function unwrapAdminList(value: unknown) {
  const data = value as { results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
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

  const id = readAdminString(record, ["id", "uuid", "reference", "code"], `${configKey}-${Math.random()}`);
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
  const status = readAdminString(record, ["status", "state", "payment_status"], "Active");
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