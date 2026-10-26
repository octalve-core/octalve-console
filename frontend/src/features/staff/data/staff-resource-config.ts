import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";
import { supportApi } from "@/lib/api/modules/support.api";
import { getFallbackData } from "@/lib/config/data-source";
import { staffDemo, type StaffRecord, type StaffResourceKey } from "./staff-demo-data";

export type StaffResourceConfig = {
  key: StaffResourceKey;
  eyebrow: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  fallback: StaffRecord[];
  loader: () => Promise<unknown>;
};

export const staffResourceConfig: Record<StaffResourceKey, StaffResourceConfig> = {
  customers: {
    key: "customers",
    eyebrow: "Customers",
    title: "Assigned customers",
    description: "Review assigned clients, account status, and service ownership.",
    searchPlaceholder: "Search customers...",
    emptyTitle: "No assigned customers found",
    emptyDescription: "Assigned customers will appear here when the backend returns staff-scoped data.",
    fallback: getFallbackData(staffDemo.customers),
    loader: () => adminApi.customers(),
  },
  orders: {
    key: "orders",
    eyebrow: "Orders",
    title: "Orders",
    description: "Review orders that need processing, provisioning, or customer follow-up.",
    searchPlaceholder: "Search orders...",
    emptyTitle: "No orders found",
    emptyDescription: "Orders assigned to staff will appear here.",
    fallback: getFallbackData(staffDemo.orders),
    loader: () => schemaApi.orders.orders(),
  },
  provisioning: {
    key: "provisioning",
    eyebrow: "Provisioning",
    title: "Provisioning queue",
    description: "Track hosting, domain, provider, and automation tasks.",
    searchPlaceholder: "Search provisioning tasks...",
    emptyTitle: "No provisioning tasks found",
    emptyDescription: "Provisioning tasks will appear here when available.",
    fallback: getFallbackData(staffDemo.provisioning),
    loader: () => schemaApi.provisioning.tasks(),
  },
  tickets: {
    key: "tickets",
    eyebrow: "Support",
    title: "Tickets",
    description: "Handle support tickets, customer replies, and operational escalations.",
    searchPlaceholder: "Search tickets...",
    emptyTitle: "No tickets found",
    emptyDescription: "Assigned support tickets will appear here.",
    fallback: getFallbackData(staffDemo.tickets),
    loader: () => supportApi.tickets(),
  },
  knowledgeBase: {
    key: "knowledgeBase",
    eyebrow: "Knowledge Base",
    title: "Knowledge base",
    description: "Review and manage internal/customer-facing support articles.",
    searchPlaceholder: "Search knowledge base articles...",
    emptyTitle: "No articles found",
    emptyDescription: "Knowledge base articles will appear here.",
    fallback: getFallbackData(staffDemo.knowledgeBase),
    loader: () => adminApi.knowledgeBase(),
  },
};