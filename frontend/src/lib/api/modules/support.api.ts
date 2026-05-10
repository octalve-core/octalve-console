// src/lib/api/modules/support.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";
import type { PaginatedResponse, SupportTicket } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const supportApi = {
  departments(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.support.departments, { params });
  },

  department(id: string | number) {
    return api.get<unknown>(byId(apiPaths.support.departments, id));
  },

  escalationRules(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.support.escalationRules, { params });
  },

  predefinedResponses(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.support.predefinedResponses, { params });
  },

  predefinedResponse(id: string | number) {
    return api.get<unknown>(byId(apiPaths.support.predefinedResponses, id));
  },

  usePredefinedResponse(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.support.predefinedResponses, id)}use/`, payload || {});
  },

  tickets(params?: ListParams) {
    return api.get<SupportTicket[] | PaginatedResponse<SupportTicket>>(
      apiPaths.support.tickets,
      { params },
    );
  },

  ticket(id: string | number) {
    return api.get<SupportTicket>(byId(apiPaths.support.tickets, id));
  },

  createTicket(payload: unknown) {
    return api.post<SupportTicket>(apiPaths.support.tickets, payload);
  },

  updateTicket(id: string | number, payload: unknown) {
    return api.patch<SupportTicket>(byId(apiPaths.support.tickets, id), payload);
  },

  deleteTicket(id: string | number) {
    return api.del(byId(apiPaths.support.tickets, id));
  },

  ticketAction(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.support.tickets, id)}action/`, payload);
  },

  replyTicket(id: string | number, payload: unknown) {
    return api.post(`${byId(apiPaths.support.tickets, id)}reply/`, payload);
  },
};

