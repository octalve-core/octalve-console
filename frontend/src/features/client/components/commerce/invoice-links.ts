export function invoiceHref(id: string | number) {
  return `/client/invoices/${encodeURIComponent(String(id))}`;
}

export function invoiceDownloadHref(id: string | number) {
  return `/api/cloud/billing/invoices/${encodeURIComponent(String(id))}/download_pdf/`;
}

export function invoicePaymentHref(id: string | number, value: unknown) {
  if (!value || typeof value !== "object" || !("kind" in value)) return undefined;
  if (value.kind === "invoice") return `/client/order/processing?invoice=${encodeURIComponent(String(id))}`;
  if (value.kind === "legacy_domain") return "/client/domains/register#sandbox-domain-purchase";
  if (value.kind === "domain" && "domain" in value && typeof value.domain === "string"
    && value.domain.length <= 253 && /^[a-z0-9.-]+\.com$/.test(value.domain)) {
    return `/client/order/checkout?product=domain&domain=${encodeURIComponent(value.domain)}`;
  }
  return undefined;
}
