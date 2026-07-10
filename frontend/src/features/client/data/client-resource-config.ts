import { clientApi } from "@/lib/api/endpoints";
import { getFallbackData } from "@/lib/config/data-source";
import { clientDemo, type ClientRecord, type ClientResourceKey } from "./client-demo-data";

export type ClientResourceConfig = {
  key: ClientResourceKey;
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  fallback: ClientRecord[];
  loader: () => Promise<unknown>;
};

export const clientResourceConfig: Record<ClientResourceKey, ClientResourceConfig> = {
  services: {
    key: "services",
    eyebrow: "Services",
    title: "My services",
    description: "Manage your hosting, VPS, email, and cloud services from one place.",
    actionHref: "/client/order",
    actionLabel: "Order service",
    searchPlaceholder: "Search services by domain, package, or status...",
    emptyTitle: "No services found",
    emptyDescription: "Your active hosting services will appear here after purchase.",
    fallback: getFallbackData(clientDemo.services),
    loader: () => clientApi.services(),
  },
  domains: {
    key: "domains",
    eyebrow: "Domains",
    title: "Domains",
    description: "Manage your domains, DNS, nameservers, expiry, and renewal status.",
    actionHref: "/client/order",
    actionLabel: "Register domain",
    searchPlaceholder: "Search domains...",
    emptyTitle: "No domains found",
    emptyDescription: "Your registered domains will appear here.",
    fallback: getFallbackData(clientDemo.domains),
    loader: () => clientApi.domains(),
  },
  invoices: {
    key: "invoices",
    eyebrow: "Billing",
    title: "Invoices",
    description: "Track unpaid, paid, pending, and overdue invoices connected to your services.",
    searchPlaceholder: "Search invoices...",
    emptyTitle: "No invoices found",
    emptyDescription: "Your invoices will appear here after an order or renewal.",
    fallback: getFallbackData(clientDemo.invoices),
    loader: () => clientApi.invoices(),
  },
  orders: {
    key: "orders",
    eyebrow: "Orders",
    title: "Orders",
    description: "Review your service orders, payment status, and provisioning progress.",
    actionHref: "/client/order",
    actionLabel: "New order",
    searchPlaceholder: "Search orders...",
    emptyTitle: "No orders found",
    emptyDescription: "Your orders will appear here after checkout.",
    fallback: getFallbackData(clientDemo.orders),
    loader: () => clientApi.orders(),
  },
  support: {
    key: "support",
    eyebrow: "Support",
    title: "Support tickets",
    description: "Open, track, and manage your support conversations with Octalve Cloud.",
    actionHref: "/client/support/new",
    actionLabel: "Open ticket",
    searchPlaceholder: "Search tickets...",
    emptyTitle: "No tickets found",
    emptyDescription: "Your support tickets will appear here.",
    fallback: getFallbackData(clientDemo.support),
    loader: () => clientApi.tickets(),
  },
};