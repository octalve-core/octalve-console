// src/lib/api/modules/settings.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const settingsApi = {
  groups(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.settings.groups, { params });
  },

  group(id: string | number) {
    return api.get<unknown>(byId(apiPaths.settings.groups, id));
  },

  settings(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.settings.settings, { params });
  },

  setting(id: string | number) {
    return api.get<unknown>(byId(apiPaths.settings.settings, id));
  },

  createSetting(payload: unknown) {
    return api.post(apiPaths.settings.settings, payload);
  },

  updateSetting(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.settings.settings, id), payload);
  },

  updateBranding(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.settings.branding, id), payload);
  },

  updateSystem(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.settings.system, id), payload);
  },

  updateTax(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.settings.tax, id), payload);
  },

  emailTemplates(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.settings.emailTemplates, { params });
  },

  emailTemplate(id: string | number) {
    return api.get<unknown>(byId(apiPaths.settings.emailTemplates, id));
  },

  createEmailTemplate(payload: unknown) {
    return api.post(apiPaths.settings.emailTemplates, payload);
  },

  updateEmailTemplate(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.settings.emailTemplates, id), payload);
  },
};

