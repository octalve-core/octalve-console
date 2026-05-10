// src/lib/api/modules/payments.api.ts

import { api } from "../client";
import type { ApiQueryParams } from "../query";
import { apiPaths, byId } from "../paths";
import type { Gateway, PaginatedResponse, Transaction } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const paymentsApi = {
  gateways(params?: ListParams) {
    return api.get<Gateway[] | PaginatedResponse<Gateway>>(apiPaths.payments.gateways, { params });
  },

  gateway(id: string | number) {
    return api.get<Gateway>(byId(apiPaths.payments.gateways, id));
  },

  createGateway(payload: unknown) {
    return api.post<Gateway>(apiPaths.payments.gateways, payload);
  },

  updateGateway(id: string | number, payload: unknown) {
    return api.patch<Gateway>(byId(apiPaths.payments.gateways, id), payload);
  },

  deleteGateway(id: string | number) {
    return api.del(byId(apiPaths.payments.gateways, id));
  },

  initialize(payload: unknown) {
    return api.post(apiPaths.payments.initialize, payload);
  },

  transactions(params?: ListParams) {
    return api.get<Transaction[] | PaginatedResponse<Transaction>>(
      apiPaths.payments.transactions,
      { params },
    );
  },

  transaction(id: string | number) {
    return api.get<Transaction>(byId(apiPaths.payments.transactions, id));
  },

  verify(params?: ApiQueryParams) {
    return api.get(apiPaths.payments.verify, { params });
  },

  webhook(gatewayCode: string, payload: unknown) {
    return api.post(`${apiPaths.payments.webhook}${encodeURIComponent(gatewayCode)}/`, payload, {
      skipAuth: true,
    });
  },
};

