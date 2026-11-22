export function invoiceHref(id: string | number) {
  return `/client/invoices/${encodeURIComponent(String(id))}`;
}

export function invoiceDownloadHref(id: string | number) {
  return `/api/cloud/billing/invoices/${encodeURIComponent(String(id))}/download_pdf/`;
}
