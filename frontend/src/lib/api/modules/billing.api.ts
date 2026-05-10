// src/lib/api/modules/billing.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";
import type { Invoice, PaginatedResponse } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const billingApi = {
  invoices(params?: ListParams) {
    return api.get<Invoice[] | PaginatedResponse<Invoice>>(apiPaths.billing.invoices, { params });
  },

  invoice(id: string | number) {
    return api.get<Invoice>(byId(apiPaths.billing.invoices, id));
  },

  createInvoice(payload: unknown) {
    return api.post<Invoice>(apiPaths.billing.invoices, payload);
  },

  updateInvoice(id: string | number, payload: unknown) {
    return api.patch<Invoice>(byId(apiPaths.billing.invoices, id), payload);
  },

  deleteInvoice(id: string | number) {
    return api.del(byId(apiPaths.billing.invoices, id));
  },

  downloadInvoicePdf(id: string | number) {
    return api.get(`${byId(apiPaths.billing.invoices, id)}download_pdf/`);
  },

  payInvoiceWithWallet(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.billing.invoices, id)}pay_with_wallet/`, payload || {});
  },

  quotes(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.billing.quotes, { params });
  },

  quote(id: string | number) {
    return api.get<unknown>(byId(apiPaths.billing.quotes, id));
  },

  acceptQuote(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.billing.quotes, id)}accept/`, payload || {});
  },

  taxes(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.billing.taxes, { params });
  },
};

