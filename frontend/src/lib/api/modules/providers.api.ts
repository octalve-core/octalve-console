// src/lib/api/modules/providers.api.ts

import { api } from "../client";
import type { ApiQueryParams } from "../query";
import { apiPaths, byId } from "../paths";
import type { PaginatedResponse, Provider } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const providersApi = {
  providers(params?: ListParams) {
    return api.get<Provider[] | PaginatedResponse<Provider>>(apiPaths.providers.providers, {
      params,
    });
  },

  provider(id: string | number) {
    return api.get<Provider>(byId(apiPaths.providers.providers, id));
  },

  createProvider(payload: unknown) {
    return api.post<Provider>(apiPaths.providers.providers, payload);
  },

  updateProvider(id: string | number, payload: unknown) {
    return api.patch<Provider>(byId(apiPaths.providers.providers, id), payload);
  },

  deleteProvider(id: string | number) {
    return api.del(byId(apiPaths.providers.providers, id));
  },

  providerHealth(id: string | number) {
    return api.get(`${byId(apiPaths.providers.providers, id)}health/`);
  },

  provisionTest(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.providers.providers, id)}provision_test/`, payload || {});
  },

  syncPackages(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.providers.providers, id)}sync_packages/`, payload || {});
  },

  testConnection(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.providers.providers, id)}test_connection/`, payload || {});
  },

  healthOverview() {
    return api.get(`${apiPaths.providers.providers}health_overview/`);
  },

  packages(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.providers.packages, { params });
  },

  package(id: string | number) {
    return api.get<unknown>(byId(apiPaths.providers.packages, id));
  },

  packagesByProvider(params?: ApiQueryParams) {
    return api.get(`${apiPaths.providers.packages}by_provider/`, { params });
  },

  logs(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.providers.logs, { params });
  },

  errorLogs() {
    return api.get(`${apiPaths.providers.logs}errors/`);
  },

  logStats() {
    return api.get(`${apiPaths.providers.logs}stats/`);
  },
};

