/** Batch C: frontend presentation mirrors Batch A/B fail-closed backend authority.
 * These constants may HIDE unqualified actions, never GRANT server permissions.
 * Only the Django API can authorize any state-changing operation.
 */
import type {AdminResourceKey} from "./admin-resource-config";

export const blockedAdminResourceWrites = {
  products: {
    reason: "Manage products and category identity through the Catalogue Workbench. This generic editor does not match the Django product schema.",
    listHref: "/admin/products",
  },
  plans: {
    reason: "Retail plan pricing and billing periods can only be revised through a supplier-backed reviewed offer draft in Catalogue.",
    listHref: "/admin/plans",
  },
  orders: {
    reason: "Orders are created through the verified customer checkout process. Manual order creation and status changes are unavailable.",
    listHref: "/admin/orders",
  },
  invoices: {
    reason: "Invoice totals, payment state and issuance belong to the verified billing workflow. Manual invoice writes are unavailable.",
    listHref: "/admin/billing/invoices",
  },
  domains: {
    reason: "Domain registration and provider changes require approved registrar authority. Manual domain creation is not available here.",
    listHref: "/admin/billing/domains",
  },
  gateways: {
    reason: "Payment gateway credentials and activation require approved secure connection management. Generic edits are unavailable.",
    listHref: "/admin/gateways",
  },
  provisioning: {
    reason: "Provisioning execution is disabled until the authorized worker, provider confirmation and reconciliation pass acceptance.",
    listHref: "/admin/provisioning",
  },
} as const satisfies Partial<Record<AdminResourceKey,{reason:string;listHref:string}>>;

export type BlockedAdminResourceKey = keyof typeof blockedAdminResourceWrites;

export function isAdminMutationDisabled(resource:AdminResourceKey):resource is BlockedAdminResourceKey{
  return Object.prototype.hasOwnProperty.call(blockedAdminResourceWrites,resource);
}
