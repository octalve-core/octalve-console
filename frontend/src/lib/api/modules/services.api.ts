// src/lib/api/modules/services.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";
import type { PaginatedResponse, Service } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const servicesApi = {
  services(params?: ListParams) {
    return api.get<Service[] | PaginatedResponse<Service>>(apiPaths.services.services, { params });
  },

  service(id: string | number) {
    return api.get<Service>(byId(apiPaths.services.services, id));
  },

  createService(payload: unknown) {
    return api.post<Service>(apiPaths.services.services, payload);
  },

  updateService(id: string | number, payload: unknown) {
    return api.patch<Service>(byId(apiPaths.services.services, id), payload);
  },

  deleteService(id: string | number) {
    return api.del(byId(apiPaths.services.services, id));
  },

  runServiceAction(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.services.services, id)}action/`, payload);
  },

  serviceActions(id: string | number) {
    return api.get(`${byId(apiPaths.services.services, id)}actions/`);
  },

  serviceCredentials(id: string | number) {
    return api.get(`${byId(apiPaths.services.services, id)}credentials/`);
  },

  updateServiceCredentials(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.services.services, id)}update_credentials/`, payload);
  },

  serviceUsage(id: string | number) {
    return api.get(`${byId(apiPaths.services.services, id)}usage/`);
  },

  changeRequests(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.services.changeRequests, { params });
  },

  changeRequest(id: string | number) {
    return api.get<unknown>(byId(apiPaths.services.changeRequests, id));
  },
};

