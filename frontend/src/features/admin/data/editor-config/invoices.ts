import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const invoicesEditorConfig: AdminEditorConfig = {
  key: "invoices",
  listHref: "/admin/billing/invoices",
  newHref: "/admin/billing/invoices/new",
  detailLabel: "Invoice profile",
  createTitle: "Create invoice",
  editTitle: "Edit invoice",
  description: "Create or update billing records connected to orders, customers, and payment status.",
  fields: [
    { name: "client", label: "Client", type: "text", placeholder: "Client name or ID", required: true },
    { name: "total", label: "Total", type: "number", placeholder: "3500", required: true },
    { name: "paid", label: "Paid amount", type: "number", placeholder: "0", required: false },
    { name: "due", label: "Due amount", type: "number", placeholder: "3500", required: false },
    { name: "date", label: "Invoice date", type: "date", required: false },
    { name: "dueDate", label: "Due date", type: "date", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
