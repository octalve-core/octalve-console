// src/lib/api/modules/domains.api.ts

import { api } from "../client";
import type { ApiQueryParams } from "../query";
import { apiPaths, byId } from "../paths";
import type { Domain, PaginatedResponse } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const domainsApi = {
  domains(params?: ListParams) {
    return api.get<Domain[] | PaginatedResponse<Domain>>(apiPaths.domains.domains, { params });
  },

  domain(id: string | number) {
    return api.get<Domain>(byId(apiPaths.domains.domains, id));
  },

  createDomain(payload: unknown) {
    return api.post<Domain>(apiPaths.domains.domains, payload);
  },

  updateDomain(id: string | number, payload: unknown) {
    return api.patch<Domain>(byId(apiPaths.domains.domains, id), payload);
  },

  deleteDomain(id: string | number) {
    return api.del(byId(apiPaths.domains.domains, id));
  },

  dnsRecords(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.domains.dnsRecords, { params });
  },

  domainDnsRecords(id: string | number) {
    return api.get(`${byId(apiPaths.domains.domains, id)}dns_records/`);
  },

  createDomainDnsRecord(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.domains.domains, id)}create_dns_record/`, payload);
  },

  deleteDomainDnsRecord(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.domains.domains, id)}delete_dns_record/`, payload);
  },

  nameservers(id: string | number) {
    return api.get(`${byId(apiPaths.domains.domains, id)}nameservers/`);
  },

  updateNameservers(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.domains.domains, id)}update_nameservers/`, payload);
  },

  renewDomain(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.domains.domains, id)}renew/`, payload || {});
  },

  checkAvailability(payload: unknown) {
    return api.post(apiPaths.domains.searchCheck, payload, { skipAuth: true });
  },

  suggestions(params?: ApiQueryParams) {
    return api.get(apiPaths.domains.searchSuggestions, { params });
  },

  registerDomain(payload: unknown) {
    return api.post(apiPaths.domains.searchRegister, payload, { skipAuth: true });
  },

  transferDomain(payload: unknown) {
    return api.post(apiPaths.domains.searchTransfer, payload, { skipAuth: true });
  },

  sslCertificates(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.domains.sslCertificates, { params });
  },

  orderSslCertificate(payload: unknown) {
    return api.post(`${apiPaths.domains.sslCertificates}order/`, payload);
  },

  tldPricing(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.domains.tldPricing, { params });
  },
};

