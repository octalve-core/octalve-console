// src/lib/api/modules/provisioning.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const provisioningApi = {
  queues(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.provisioning.queues, { params });
  },

  queue(id: string | number) {
    return api.get<unknown>(byId(apiPaths.provisioning.queues, id));
  },

  queueMetrics() {
    return api.get(`${apiPaths.provisioning.queues}metrics/`);
  },

  tasks(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.provisioning.tasks, { params });
  },

  task(id: string | number) {
    return api.get<unknown>(byId(apiPaths.provisioning.tasks, id));
  },

  createTask(payload: unknown) {
    return api.post(apiPaths.provisioning.tasks, payload);
  },

  updateTask(id: string | number, payload: unknown) {
    return api.patch(byId(apiPaths.provisioning.tasks, id), payload);
  },

  deleteTask(id: string | number) {
    return api.del(byId(apiPaths.provisioning.tasks, id));
  },

  cancelTask(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.provisioning.tasks, id)}cancel/`, payload || {});
  },

  markTaskNeedsReview(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.provisioning.tasks, id)}mark_needs_review/`, payload || {});
  },

  retryTask(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.provisioning.tasks, id)}retry/`, payload || {});
  },

  pendingTasks() {
    return api.get(`${apiPaths.provisioning.tasks}pending/`);
  },

  processNextTask(payload?: unknown) {
    return api.post(`${apiPaths.provisioning.tasks}process_next/`, payload || {});
  },

  taskStats() {
    return api.get(`${apiPaths.provisioning.tasks}stats/`);
  },

  webhooks(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.provisioning.webhooks, { params });
  },

  webhook(id: string | number) {
    return api.get<unknown>(byId(apiPaths.provisioning.webhooks, id));
  },

  testWebhook(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.provisioning.webhooks, id)}test/`, payload || {});
  },
};

