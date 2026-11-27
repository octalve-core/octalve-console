export function invoiceHref(id: string | number) {
  return `/client/invoices/${encodeURIComponent(String(id))}`;
}
export function invoiceDownloadHref(id: string | number) {
  return `/api/cloud/billing/invoices/${encodeURIComponent(String(id))}/download_pdf/`;
}
export function invoiceCheckoutHref(id: string | number): string {
  const value=String(id);
  if(!/^(?:[1-9][0-9]{0,14}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(value)) return "/client/invoices";
  return `/client/order/checkout?view=invoice&invoice=${value}`;
}
export function invoicePaymentHref(id: string | number, value: unknown) {
  if (!value || typeof value !== "object" || !("kind" in value)
      || !["invoice","combined_domain","domain","legacy_domain"].includes(String(value.kind))
      || !/^(?:[1-9][0-9]{0,14}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(String(id))) return undefined;
  return invoiceCheckoutHref(id);
}
