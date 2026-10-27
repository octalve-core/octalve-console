import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const domainsEditorConfig: AdminEditorConfig = {
  key: "domains",
  listHref: "/admin/billing/domains",
  newHref: "/admin/billing/domains/new",
  detailLabel: "Domain profile",
  createTitle: "Add domain",
  editTitle: "Edit domain",
  description: "Manage domain ownership, registrar, expiry, price, and renewal settings.",
  fields: [
    { name: "domain", label: "Domain", type: "text", placeholder: "example.com", required: true },
    { name: "client", label: "Client", type: "text", placeholder: "Client name or ID", required: true },
    { name: "registrar", label: "Registrar", type: "text", placeholder: "Registrar API", required: false },
    { name: "price", label: "Price", type: "number", placeholder: "14500", required: false },
    { name: "renewal", label: "Renewal", type: "text", placeholder: "Auto-renew ready", required: false },
    { name: "expiry", label: "Expiry date", type: "date", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
