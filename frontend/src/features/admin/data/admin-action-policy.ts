/** Batch C: frontend presentation mirrors Batch A/B fail-closed backend authority.
 * These constants may HIDE unqualified actions, never GRANT server permissions.
 * Only the Django API can authorize any state-changing operation.
 */
import type {AdminResourceKey} from "./admin-resource-config";

export const blockedAdminResourceWrites = {
  products: {
    reason: "Product details can be updated from the Catalogue.",
    listHref: "/admin/products",
  },
  plans: {
    reason: "Update plan prices and billing options through the Catalogue.",
    listHref: "/admin/plans",
  },
  orders: {
    reason: "New orders are placed through checkout. You can review existing orders here.",
    listHref: "/admin/orders",
  },
  invoices: {
    reason: "Invoices are issued from customer orders and renewals. Review them in the billing section.",
    listHref: "/admin/billing/invoices",
  },
  domains: {
    reason: "Register or transfer domains using an available domain service.",
    listHref: "/admin/billing/domains",
  },
  gateways: {
    reason: "Payment connection settings are managed in Integrations.",
    listHref: "/admin/gateways",
  },
  provisioning: {
    reason: "Service setup will be available when your provider connections are ready.",
    listHref: "/admin/provisioning",
  },
} as const satisfies Partial<Record<AdminResourceKey,{reason:string;listHref:string}>>;

export type BlockedAdminResourceKey = keyof typeof blockedAdminResourceWrites;

export function isAdminMutationDisabled(resource:AdminResourceKey):resource is BlockedAdminResourceKey{
  return Object.prototype.hasOwnProperty.call(blockedAdminResourceWrites,resource);
}
