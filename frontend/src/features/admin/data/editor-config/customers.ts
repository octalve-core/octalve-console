import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const customersEditorConfig: AdminEditorConfig = {
  key: "customers",
  listHref: "/admin/customers",
  newHref: "/admin/customers/new",
  detailLabel: "Customer profile",
  createTitle: "Add customer",
  editTitle: "Edit customer",
  description: "Create or update a customer record for hosting, billing, and support access.",
  fields: [
    { name: "name", label: "Customer name", type: "text", placeholder: "Customer name", required: true },
    { name: "email", label: "Email address", type: "email", placeholder: "client@example.com", required: true },
    { name: "phone", label: "Phone number", type: "text", placeholder: "+234...", required: false },
    { name: "balance", label: "Balance", type: "text", placeholder: "â‚¦0", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
