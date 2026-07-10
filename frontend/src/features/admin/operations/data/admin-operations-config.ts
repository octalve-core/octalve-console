import { adminApi } from "@/lib/api/endpoints";
import { auditApi } from "@/lib/api/modules/audit.api";
import { reportsApi } from "@/lib/api/modules/reports.api";
import { supportApi } from "@/lib/api/modules/support.api";
import { getFallbackData } from "@/lib/config/data-source";
import { adminOperationsDemo, type AdminOperationKey, type AdminOperationRecord } from "./admin-operations-data";

export type AdminOperationConfig = {
  key: AdminOperationKey;
  eyebrow: string;
  title: string;
  description: string;
  createHref?: string;
  createLabel?: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  fallback: AdminOperationRecord[];
  loader: () => Promise<unknown>;
};

export const adminOperationConfig: Record<AdminOperationKey, AdminOperationConfig> = {
  support: {
    key: "support",
    eyebrow: "Support",
    title: "Support tickets",
    description: "Manage customer tickets, replies, priorities, departments, and support workflow.",
    createHref: "/admin/support/new",
    createLabel: "New ticket",
    searchPlaceholder: "Search support tickets...",
    emptyTitle: "No tickets found",
    emptyDescription: "Support tickets from the Django API will appear here.",
    fallback: getFallbackData(adminOperationsDemo.support),
    loader: () => supportApi.tickets(),
  },
  departments: {
    key: "departments",
    eyebrow: "Support",
    title: "Departments",
    description: "Manage support departments and internal routing for customer issues.",
    searchPlaceholder: "Search departments...",
    emptyTitle: "No departments found",
    emptyDescription: "Support departments from the backend will appear here.",
    fallback: getFallbackData(adminOperationsDemo.departments),
    loader: () => supportApi.departments(),
  },
  responses: {
    key: "responses",
    eyebrow: "Support",
    title: "Predefined responses",
    description: "Manage saved replies for billing, hosting, DNS, SSL, and provisioning support.",
    searchPlaceholder: "Search responses...",
    emptyTitle: "No responses found",
    emptyDescription: "Predefined responses from the backend will appear here.",
    fallback: getFallbackData(adminOperationsDemo.responses),
    loader: () => supportApi.predefinedResponses(),
  },
  "knowledge-base": {
    key: "knowledge-base",
    eyebrow: "Knowledge Base",
    title: "Knowledge base",
    description: "Create and manage customer-facing help articles and internal support guides.",
    createHref: "/admin/knowledge-base/new",
    createLabel: "New article",
    searchPlaceholder: "Search articles...",
    emptyTitle: "No articles found",
    emptyDescription: "Knowledge base articles from the backend will appear here.",
    fallback: getFallbackData(adminOperationsDemo["knowledge-base"]),
    loader: () => adminApi.knowledgeBase(),
  },
  "audit-logs": {
    key: "audit-logs",
    eyebrow: "Audit",
    title: "Audit logs",
    description: "Review admin activity, API logs, login attempts, security events, and exports.",
    searchPlaceholder: "Search logs...",
    emptyTitle: "No audit logs found",
    emptyDescription: "Audit records from the backend will appear here.",
    fallback: getFallbackData(adminOperationsDemo["audit-logs"]),
    loader: () => auditApi.logs(),
  },
  reports: {
    key: "reports",
    eyebrow: "Reports",
    title: "Reports",
    description: "Monitor financial, operational, provisioning, and customer activity reports.",
    searchPlaceholder: "Search reports...",
    emptyTitle: "No reports found",
    emptyDescription: "Report definitions from the backend will appear here.",
    fallback: getFallbackData(adminOperationsDemo.reports),
    loader: () => reportsApi.definitions(),
  },
  notifications: {
    key: "notifications",
    eyebrow: "Notifications",
    title: "Notification templates",
    description: "Manage templates for invoices, orders, tickets, services, verification and password reset.",
    createHref: "/admin/settings/notifications/new",
    createLabel: "New template",
    searchPlaceholder: "Search templates...",
    emptyTitle: "No notification templates found",
    emptyDescription: "Notification templates from the backend will appear here.",
    fallback: getFallbackData(adminOperationsDemo.notifications),
    loader: () => adminApi.notificationTemplates(),
  },
};