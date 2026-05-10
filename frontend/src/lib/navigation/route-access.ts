import type { UserRole } from "@/lib/api/types";
import { routes } from "@/lib/routes";

export type RouteAccessRole = UserRole | "public";

export type RouteAccessArea =
  | "Auth"
  | "Admin"
  | "Client"
  | "Staff"
  | "System";

export type RouteAccessItem = {
  label: string;
  path: string;
  area: RouteAccessArea;
  role: RouteAccessRole;
  status: "Migrated" | "Protected" | "Public" | "Utility";
  notes: string;
};

export const routeAccessItems: RouteAccessItem[] = [
  {
    label: "Home",
    path: routes.home,
    area: "System",
    role: "public",
    status: "Public",
    notes: "Public landing/root route.",
  },
  {
    label: "Login",
    path: routes.auth.login,
    area: "Auth",
    role: "public",
    status: "Public",
    notes: "Django JWT login connected through auth module.",
  },
  {
    label: "Signup",
    path: routes.auth.signup,
    area: "Auth",
    role: "public",
    status: "Public",
    notes: "Django registration connected through auth module.",
  },
  {
    label: "Forgot Password",
    path: routes.auth.forgotPassword,
    area: "Auth",
    role: "public",
    status: "Public",
    notes: "Password reset request connected to Django auth endpoint.",
  },

  {
    label: "Admin Overview",
    path: routes.admin.root,
    area: "Admin",
    role: "admin",
    status: "Protected",
    notes: "Admin dashboard and metrics.",
  },
  {
    label: "Admin Customers",
    path: routes.admin.customers,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Customer list, detail, and create/edit routes migrated.",
  },
  {
    label: "Admin Products",
    path: routes.admin.products,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Catalog product management migrated.",
  },
  {
    label: "Admin Plans",
    path: routes.admin.plans,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Plan and pricing management migrated.",
  },
  {
    label: "Admin Orders",
    path: routes.admin.orders,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Order management migrated.",
  },
  {
    label: "Admin Invoices",
    path: routes.admin.invoices,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Invoice list/detail/create pages migrated.",
  },
  {
    label: "Admin Domains",
    path: routes.admin.domains,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Domain management migrated.",
  },
  {
    label: "Admin Gateways",
    path: routes.admin.gateways,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Payment gateway management migrated.",
  },
  {
    label: "Admin Providers",
    path: routes.admin.providers,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Provider/server adapter management migrated.",
  },
  {
    label: "Admin Provisioning",
    path: routes.admin.provisioning,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Provisioning queue and task creation migrated.",
  },
  {
    label: "Admin Support",
    path: routes.admin.support,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Support tickets, departments, and responses migrated.",
  },
  {
    label: "Admin Knowledge Base",
    path: routes.admin.knowledgeBase,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Knowledge base list/detail/create pages migrated.",
  },
  {
    label: "Admin Settings",
    path: routes.admin.settings,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Settings hub and settings section pages migrated.",
  },
  {
    label: "Admin Reports",
    path: routes.admin.reports,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Reports workspace migrated.",
  },
  {
    label: "Admin Audit Logs",
    path: routes.admin.auditLogs,
    area: "Admin",
    role: "admin",
    status: "Migrated",
    notes: "Audit log workspace migrated.",
  },
  {
    label: "Route Audit",
    path: routes.admin.utilities,
    area: "Admin",
    role: "admin",
    status: "Utility",
    notes: "Route, navigation, and role-access audit page.",
  },

  {
    label: "Client Dashboard",
    path: routes.client.root,
    area: "Client",
    role: "client",
    status: "Protected",
    notes: "Client dashboard migrated.",
  },
  {
    label: "Client Services",
    path: routes.client.services,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Client service list/detail pages migrated.",
  },
  {
    label: "Client Domains",
    path: routes.client.domains,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Client domain list/detail pages migrated.",
  },
  {
    label: "Client Invoices",
    path: routes.client.invoices,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Client invoice list/detail pages migrated.",
  },
  {
    label: "Client Orders",
    path: routes.client.orders,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Client order history and detail pages migrated.",
  },
  {
    label: "Client Order Flow",
    path: routes.client.order,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Order selection and checkout pages migrated.",
  },
  {
    label: "Client Wallet",
    path: routes.client.wallet,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Wallet overview migrated.",
  },
  {
    label: "Client Support",
    path: routes.client.support,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Ticket list, detail, and create routes migrated.",
  },
  {
    label: "Client Profile",
    path: routes.client.profile,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Profile page migrated.",
  },
  {
    label: "Client Knowledge Base",
    path: routes.client.knowledgeBase,
    area: "Client",
    role: "client",
    status: "Migrated",
    notes: "Client knowledge base list/detail pages migrated.",
  },

  {
    label: "Staff Dashboard",
    path: routes.staff.root,
    area: "Staff",
    role: "staff",
    status: "Protected",
    notes: "Staff dashboard migrated.",
  },
  {
    label: "Staff Customers",
    path: routes.staff.customers,
    area: "Staff",
    role: "staff",
    status: "Migrated",
    notes: "Staff customer workspace migrated.",
  },
  {
    label: "Staff Orders",
    path: routes.staff.orders,
    area: "Staff",
    role: "staff",
    status: "Migrated",
    notes: "Staff order workspace migrated.",
  },
  {
    label: "Staff Provisioning",
    path: routes.staff.provisioning,
    area: "Staff",
    role: "staff",
    status: "Migrated",
    notes: "Staff provisioning workspace migrated.",
  },
  {
    label: "Staff Tickets",
    path: routes.staff.tickets,
    area: "Staff",
    role: "staff",
    status: "Migrated",
    notes: "Staff ticket workspace migrated.",
  },
  {
    label: "Staff Knowledge Base",
    path: routes.staff.knowledgeBase,
    area: "Staff",
    role: "staff",
    status: "Migrated",
    notes: "Staff knowledge base migrated.",
  },
  {
    label: "Staff Security",
    path: routes.staff.security,
    area: "Staff",
    role: "staff",
    status: "Migrated",
    notes: "Staff security overview migrated.",
  },
];

export function getRoleForPath(pathname: string): RouteAccessRole {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/client")) return "client";
  if (pathname.startsWith("/staff")) return "staff";
  return "public";
}

export function canAccessPath(role: UserRole | null | undefined, pathname: string) {
  const requiredRole = getRoleForPath(pathname);

  if (requiredRole === "public") return true;
  if (!role) return false;

  return role === requiredRole;
}

export function getRouteAccessSummary() {
  return {
    total: routeAccessItems.length,
    public: routeAccessItems.filter((item) => item.role === "public").length,
    admin: routeAccessItems.filter((item) => item.role === "admin").length,
    client: routeAccessItems.filter((item) => item.role === "client").length,
    staff: routeAccessItems.filter((item) => item.role === "staff").length,
    migrated: routeAccessItems.filter((item) => item.status === "Migrated").length,
  };
}