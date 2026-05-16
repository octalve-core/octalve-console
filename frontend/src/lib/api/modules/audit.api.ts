// src/lib/api/modules/audit.api.ts

import { api } from "../client";
import type { ApiQueryParams } from "../query";
import { apiPaths, byId } from "../paths";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const auditApi = {
  apiLogs(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.audit.apiLogs, { params });
  },

  apiLog(id: string | number) {
    return api.get<unknown>(byId(apiPaths.audit.apiLogs, id));
  },

  errorRequests() {
    return api.get(`${apiPaths.audit.apiLogs}error_requests/`);
  },

  slowRequests() {
    return api.get(`${apiPaths.audit.apiLogs}slow_requests/`);
  },

  loginAttempts(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.audit.loginAttempts, { params });
  },

  failedLoginAttempts() {
    return api.get(`${apiPaths.audit.loginAttempts}failed_attempts/`);
  },

  loginAttemptsByIp() {
    return api.get(`${apiPaths.audit.loginAttempts}by_ip/`);
  },

  logs(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.audit.logs, { params });
  },

  log(id: string | number) {
    return api.get<unknown>(byId(apiPaths.audit.logs, id));
  },

  logStats() {
    return api.get(`${apiPaths.audit.logs}stats/`);
  },

  userActivity(params?: ApiQueryParams) {
    return api.get(`${apiPaths.audit.logs}user_activity/`, { params });
  },

  entityActivity(params?: ApiQueryParams) {
    return api.get(`${apiPaths.audit.logs}entity_activity/`, { params });
  },

  securityEvents(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.audit.securityEvents, { params });
  },

  resolveSecurityEvent(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.audit.securityEvents, id)}resolve/`, payload || {});
  },

  dataExports(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.audit.dataExports, { params });
  },

  exportInvoices(payload: unknown) {
    return api.post(`${apiPaths.audit.dataExports}export_invoices/`, payload);
  },
};

