// src/lib/api/modules/reports.api.ts

import { api } from "../client";
import type { ApiQueryParams } from "../query";
import { apiPaths, byId } from "../paths";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const reportsApi = {
  businessSnapshot(currency: string) {
    return api.get<unknown>(apiPaths.reports.businessSnapshot, {params: {currency}});
  },
  definitions(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.reports.definitions, { params });
  },

  definition(id: string | number) {
    return api.get<unknown>(byId(apiPaths.reports.definitions, id));
  },

  createDefinition(payload: unknown) {
    return api.post(apiPaths.reports.definitions, payload);
  },

  updateDefinition(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.reports.definitions, id), payload);
  },

  generateDefinition(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.reports.definitions, id)}generate/`, payload || {});
  },

  filters(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.reports.filters, { params });
  },

  setDefaultFilter(payload: unknown) {
    return api.post(`${apiPaths.reports.filters}set_default/`, payload);
  },

  instances(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.reports.instances, { params });
  },

  instance(id: string | number) {
    return api.get<unknown>(byId(apiPaths.reports.instances, id));
  },

  deleteInstance(id: string | number) {
    return api.del(`${byId(apiPaths.reports.instances, id)}delete/`);
  },

  metrics(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.reports.metrics, { params });
  },

  metric(id: string | number) {
    return api.get<unknown>(byId(apiPaths.reports.metrics, id));
  },

  metricHistory(id: string | number) {
    return api.get(`${byId(apiPaths.reports.metrics, id)}history/`);
  },

  widgets(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.reports.widgets, { params });
  },

  widgetDashboardData() {
    return api.get(`${apiPaths.reports.widgets}dashboard_data/`);
  },

  revenueByGateway(params?: ApiQueryParams) {
    return api.get(apiPaths.reports.financialRevenueByGateway, { params });
  },

  revenueByProduct(params?: ApiQueryParams) {
    return api.get(apiPaths.reports.financialRevenueByProduct, { params });
  },

  revenueSummary(params?: ApiQueryParams) {
    return api.get(apiPaths.reports.financialRevenueSummary, { params });
  },
};

