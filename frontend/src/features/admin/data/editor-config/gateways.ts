import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const gatewaysEditorConfig: AdminEditorConfig = {
  key: "gateways",
  listHref: "/admin/gateways",
  newHref: "/admin/gateways/new",
  detailLabel: "Gateway profile",
  createTitle: "Add gateway",
  editTitle: "Edit gateway",
  description: "Configure payment gateways like Paystack, Flutterwave, wallet, and bank transfer.",
  fields: [
    { name: "name", label: "Gateway name", type: "text", placeholder: "Paystack", required: true },
    { name: "display_name", label: "Display name", type: "text", placeholder: "Paystack", required: true },
    { name: "public_key", label: "Public key", type: "text", placeholder: "pk_test_...", required: false },
    { name: "secret_key", label: "Secret key", type: "password", placeholder: "sk_test_...", required: false },
    { name: "webhook_secret", label: "Webhook secret", type: "password", placeholder: "Optional", required: false },
    { name: "summary", label: "Summary", type: "textarea", placeholder: "Describe gateway usage", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
