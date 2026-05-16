import type { StaffRecord, StaffResourceKey } from "../data/staff-demo-data";

export function unwrapStaffList(value: unknown) {
  const data = value as { results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function readString(item: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = item[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

function getStaffBasePath(resource: StaffResourceKey) {
  const routeMap: Record<StaffResourceKey, string> = {
    customers: "/staff/customers",
    orders: "/staff/orders",
    provisioning: "/staff/provisioning",
    tickets: "/staff/tickets",
    knowledgeBase: "/staff/knowledge-base",
  };

  return routeMap[resource];
}

export function normalizeStaffRecord(item: unknown, resource: StaffResourceKey): StaffRecord {
  const record = item as Record<string, unknown>;

  const id = readString(record, ["id", "uuid", "reference", "code"], `${resource}-${Math.random()}`);
  const title = readString(record, ["name", "title", "subject", "domain", "email", "product"], id);
  const subtitle = readString(record, ["email", "description", "summary", "customer", "client", "product"], resource);
  const meta = readString(record, ["department", "category", "type", "priority", "status"], "API record");
  const status = readString(record, ["status", "state", "level"], "Active");
  const date = readString(record, ["created_at", "updated_at", "date", "time"], "");

  const basePath = getStaffBasePath(resource);
  const detailHref = resource === "knowledgeBase" ? `${basePath}/${encodeURIComponent(id)}` : basePath;

  return {
    id,
    title,
    subtitle,
    meta,
    status,
    date,
    actionHref: detailHref,
  };
}