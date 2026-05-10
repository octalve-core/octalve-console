import { routes } from "@/lib/routes";

export type DashboardRole = "admin" | "client" | "staff";

export type DashboardNavIcon =
  | "layoutDashboard"
  | "users"
  | "boxes"
  | "listChecks"
  | "receiptText"
  | "creditCard"
  | "globe2"
  | "server"
  | "zap"
  | "lifeBuoy"
  | "bookOpen"
  | "settings"
  | "shield"
  | "barChart3"
  | "walletCards"
  | "shoppingCart"
  | "userRound"
  | "ticket"
  | "packageCheck";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: DashboardNavIcon;
  description?: string;
  badge?: string;
};

export type DashboardNavGroup = {
  title: string;
  items: DashboardNavItem[];
};

export const adminNavGroups: DashboardNavGroup[] = [
  {
    title: "Command",
    items: [
      {
        label: "Overview",
        href: routes.admin.root,
        icon: "layoutDashboard",
        description: "Admin control center",
      },
      {
        label: "Customers",
        href: routes.admin.customers,
        icon: "users",
        description: "Manage client accounts",
      },
      {
        label: "Staff",
        href: "/admin/staff",
        icon: "shield",
        description: "Team access and roles",
      },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        label: "Products",
        href: routes.admin.products,
        icon: "boxes",
        description: "Hosting products and services",
      },
      {
        label: "Plans",
        href: routes.admin.plans,
        icon: "listChecks",
        description: "Pricing and billing cycles",
      },
      {
        label: "Orders",
        href: routes.admin.orders,
        icon: "shoppingCart",
        description: "Customer orders",
      },
      {
        label: "Invoices",
        href: routes.admin.invoices,
        icon: "receiptText",
        description: "Billing and payments",
      },
      {
        label: "Transactions",
        href: routes.admin.transactions,
        icon: "creditCard",
        description: "Payment history",
      },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      {
        label: "Services",
        href: routes.admin.services,
        icon: "packageCheck",
        description: "Hosting accounts and services",
      },
      {
        label: "Domains",
        href: routes.admin.domains,
        icon: "globe2",
        description: "Domain registration and renewals",
      },
      {
        label: "Gateways",
        href: routes.admin.gateways,
        icon: "creditCard",
        description: "Payment providers",
      },
      {
        label: "Providers",
        href: routes.admin.providers,
        icon: "server",
        description: "DirectAdmin, cPanel, VPS and panels",
      },
      {
        label: "Provisioning",
        href: routes.admin.provisioning,
        icon: "zap",
        description: "Automation queue",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Support",
        href: routes.admin.support,
        icon: "lifeBuoy",
        description: "Tickets and departments",
      },
      {
        label: "Knowledge Base",
        href: routes.admin.knowledgeBase,
        icon: "bookOpen",
        description: "Help articles",
      },
      {
        label: "Reports",
        href: "/admin/reports",
        icon: "barChart3",
        description: "Revenue and operations",
      },
      {
        label: "Settings",
        href: routes.admin.settings,
        icon: "settings",
        description: "System configuration",
      },
    ],
  },
];

export const clientNavGroups: DashboardNavGroup[] = [
  {
    title: "Account",
    items: [
      {
        label: "Overview",
        href: routes.client.root,
        icon: "layoutDashboard",
        description: "Client dashboard",
      },
      {
        label: "Services",
        href: routes.client.services,
        icon: "packageCheck",
        description: "Hosting services",
      },
      {
        label: "Domains",
        href: routes.client.domains,
        icon: "globe2",
        description: "Domains and DNS",
      },
      {
        label: "Invoices",
        href: routes.client.invoices,
        icon: "receiptText",
        description: "Billing records",
      },
      {
        label: "Orders",
        href: routes.client.orders,
        icon: "shoppingCart",
        description: "Order history",
      },
      {
        label: "Wallet",
        href: routes.client.wallet,
        icon: "walletCards",
        description: "Balance and funding",
      },
    ],
  },
  {
    title: "Help",
    items: [
      {
        label: "Support",
        href: routes.client.support,
        icon: "lifeBuoy",
        description: "Open and track tickets",
      },
      {
        label: "Knowledge Base",
        href: routes.client.knowledgeBase,
        icon: "bookOpen",
        description: "Guides and articles",
      },
      {
        label: "Profile",
        href: routes.client.profile,
        icon: "userRound",
        description: "Account details",
      },
    ],
  },
];

export const staffNavGroups: DashboardNavGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Overview",
        href: routes.staff.root,
        icon: "layoutDashboard",
        description: "Staff dashboard",
      },
      {
        label: "Customers",
        href: routes.staff.customers,
        icon: "users",
        description: "Assigned clients",
      },
      {
        label: "Orders",
        href: routes.staff.orders,
        icon: "shoppingCart",
        description: "Order processing",
      },
      {
        label: "Provisioning",
        href: routes.staff.provisioning,
        icon: "zap",
        description: "Service automation",
      },
      {
        label: "Tickets",
        href: routes.staff.tickets,
        icon: "ticket",
        description: "Support work queue",
      },
      {
        label: "Knowledge Base",
        href: routes.staff.knowledgeBase,
        icon: "bookOpen",
        description: "Internal resources",
      },
    ],
  },
];

export function getDashboardNavGroups(role: DashboardRole) {
  if (role === "admin") return adminNavGroups;
  if (role === "staff") return staffNavGroups;
  return clientNavGroups;
}

export function getDashboardHome(role: DashboardRole) {
  if (role === "admin") return routes.admin.root;
  if (role === "staff") return routes.staff.root;
  return routes.client.root;
}