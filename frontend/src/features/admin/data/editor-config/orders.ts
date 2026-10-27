import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const ordersEditorConfig: AdminEditorConfig = {
  key: "orders",
  listHref: "/admin/orders",
  newHref: "/admin/orders/new",
  detailLabel: "Order profile",
  createTitle: "Create order",
  editTitle: "Edit order",
  description: "Create or update a customer order before provisioning and invoicing.",
  fields: [
    { name: "customer", label: "Customer", type: "text", placeholder: "Customer ID or name", required: true },
    { name: "product", label: "Product", type: "text", placeholder: "Web Hosting", required: true },
    { name: "total", label: "Total", type: "number", placeholder: "3500", required: true },
    { name: "date", label: "Order date", type: "date", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
