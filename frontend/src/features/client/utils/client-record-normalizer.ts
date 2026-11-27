import {publicResourceId} from "../../../lib/commerce/resource-id.ts";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import {displayMoney} from "../../../lib/i18n/formatters.ts";
import {normalizeServiceSnapshot} from "./service-contract.ts";
import {invoicePaymentHref} from "../components/commerce/invoice-links.ts";

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
  const publicId=publicResourceId(record.public_id,id);
  const publicReference=readClientString(record,["public_reference"],"");
  if (!id) throw new Error("Account record is missing its identifier.");
  const title = readClientString(
    record,
    ["domain_name", "name", "title", "domain", "label", "subject", "public_reference", "invoice_number", "order_number", "product"],
    id,
  );
  const subtitle = readClientString(
    record,
    ["product_name", "plan_name", "service_type", "email", "summary", "description", "package", "product", "department", "client", "customer"],
    resource,
  );
  const meta = readClientString(
    record,
    ["public_reference", "invoice_number", "order_number", "ticket_number", "reference", "domain_name", "type", "cycle", "adapter", "registrar", "priority", "term"],
    "—",
  );
  const amount = readClientString(record, ["total", "price", "amount", "balance", "due", "paid"], "");
  const currency = readClientString(record, ["currency", "currency_code"], "").trim().toUpperCase();
  const status = readClientString(record, ["status", "state", "payment_status"], "Unknown");
  const date = readClientString(record, ["expiry_date", "expiration_date", "next_due_date", "due_date", "date", "created_at", "updated_at", "dueDate", "expiry", "renews"], "");
  const invoicePeriods = resource === "invoices" && Array.isArray(record.items) ? record.items.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const period = item.confirmed_period;
    const confirmed = !!period && typeof period.start === "string" && typeof period.end === "string";
    const start = confirmed ? period.start : item.period_start;
    const end = confirmed ? period.end : item.period_end;
    return typeof start === "string" && typeof end === "string" ? [{
      label: typeof item.description === "string" ? item.description : "Invoice item",
      start, end, confirmed, domain: confirmed && period.kind === "domain",
    }] : [];
  }) : undefined;

  return {
    id,
    publicId,
    publicReference,
    documentNumber:readClientString(record,["invoice_number","order_number"],""),
    accountReference:readClientString(record,["client_reference"],""),
    orderReference:readClientString(record,["order_reference"],""),
    title,
    subtitle,
    meta,
    paymentReference: resource==="orders"||resource==="invoices"?readClientString(record,["payment_reference"],""):undefined,
    amount: amount && /^[A-Z]{3}$/.test(currency) ? displayMoney(amount,currency,"en") : amount,
    status,
    date,
    actionHref: `${getClientResourceBasePath(resource)}/${encodeURIComponent(publicId)}`,
    score: undefined,
    service: resource === "services" ? normalizeServiceSnapshot(record) : undefined,
    invoicePeriods,
    invoiceDocuments: resource === "orders" && Array.isArray(record.invoice_documents)
      ? record.invoice_documents.flatMap(item => item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.number === "string"
        ? [{id:publicResourceId(item.public_id,item.id), number:typeof item.public_reference==="string"?item.public_reference:item.number, paymentHref:invoicePaymentHref(publicResourceId(item.public_id,item.id),item.payment_resume)}] : [])
      : undefined,
    paymentHref: resource === "invoices" ? invoicePaymentHref(publicId, record.payment_resume) : undefined,
    testCheckoutHref: resource === "invoices" && record.test_checkout_status === true
      ? invoicePaymentHref(publicId, {kind:"combined_domain"}) : undefined,
    createdDate: readClientString(record,["created_at","date_created"],""),
    dueDate: resource === "invoices" ? readClientString(record,["due_date","dueDate"],"") : undefined,
    issuedDate: resource === "invoices" ? readClientString(record,["issue_date"],"") : undefined,
    paidDate: resource === "invoices" ? readClientString(record,["paid_at"],"") : undefined,
  };
}
