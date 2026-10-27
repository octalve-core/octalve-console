import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const plansEditorConfig: AdminEditorConfig = {
  key: "plans",
  listHref: "/admin/plans",
  newHref: "/admin/plans/new",
  detailLabel: "Plan profile",
  createTitle: "Add plan",
  editTitle: "Edit plan",
  description: "Manage pricing, billing cycle, resource limits, and package availability.",
  fields: [
    { name: "name", label: "Plan name", type: "text", placeholder: "Business", required: true },
    { name: "product", label: "Product", type: "text", placeholder: "Web Hosting", required: true },
    { name: "price", label: "Price", type: "number", placeholder: "3500", required: true },
    { name: "currency", label: "Currency", type: "text", placeholder: "NGN", required: true },
    { name: "cycle", label: "Billing cycle", type: "text", placeholder: "monthly", required: true },
    { name: "storage", label: "Storage", type: "text", placeholder: "10GB SSD", required: false },
    { name: "bandwidth", label: "Bandwidth", type: "text", placeholder: "100GB", required: false },
    { name: "adapter", label: "Adapter", type: "text", placeholder: "directadmin", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
