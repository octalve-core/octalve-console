import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";

export function unwrapClientList(value: unknown) {
  const data = value as { results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
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
    ["name", "title", "domain", "label", "subject", "invoice_number", "order_number", "product"],
    id,
  );
  const subtitle = readClientString(
    record,
    ["email", "summary", "description", "package", "product", "department", "client", "customer"],
    resource,
  );
  const meta = readClientString(
    record,
    ["status", "type", "cycle", "adapter", "registrar", "priority", "term"],
    "—",
  );
  const amount = readClientString(record, ["total", "price", "amount", "balance", "due", "paid"], "");
  const status = readClientString(record, ["status", "state", "payment_status"], "Unknown");
  const date = readClientString(record, ["date", "created_at", "updated_at", "dueDate", "expiry", "renews"], "");

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
  };
}