import type {AdminEditorConfig} from "./types";

/** Existing resource editor definition; service authority is unchanged. */
export const providersEditorConfig: AdminEditorConfig = {
  key: "providers",
  listHref: "/admin/servers",
  newHref: "/admin/servers/new",
  detailLabel: "Provider profile",
  createTitle: "Add provider",
  editTitle: "Edit provider",
  description: "Connect infrastructure providers like DirectAdmin, cPanel, VPS, and registrar APIs.",
  fields: [
    { name: "name", label: "Provider name", type: "text", placeholder: "DirectAdmin Node 1", required: true },
    { name: "adapter_type", label: "Adapter type", type: "select", required: true, options: [
      { label: "DirectAdmin (only currently implemented adapter)", value: "DirectAdminAdapter" },
      { label: "cPanel / WHM inventory", value: "CpanelAdapter" },
      { label: "Domain registrar (integration required)", value: "DomainRegistrarAdapter" },
      { label: "DNS / Cloudflare (integration required)", value: "CloudflareAdapter" },
      { label: "SSL issuer (integration required)", value: "SslProviderAdapter" },
    ] },
    { name: "fulfillment_model", label: "Infrastructure / resale model", type: "select", required: true, options: [
      { label: "Octalve-operated server", value: "owned_server" },
      { label: "Authorized partner / reseller", value: "partner_reseller" },
    ] },
    { name: "server_group", label: "Server group / region (optional)", type: "text", placeholder: "lagos-01", required: false },
    { name: "base_url", label: "Provider API URL", type: "text", placeholder: "https://your-provider.example", required: true },
    { name: "username", label: "Provider account name", type: "text", placeholder: "Scoped API username", required: false },
    { name: "api_key", label: "API key (write-only)", type: "password", placeholder: "Stored encrypted; not shown after saving", required: false },
    { name: "secret", label: "Secret (write-only)", type: "password", placeholder: "Do not paste credentials into chat", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: [
      { label: "Inactive until verified", value: "inactive" },
      { label: "Active (requires verified adapter)", value: "active" },
      { label: "Maintenance", value: "maintenance" },
      { label: "Error", value: "error" },
    ] },
  ],
};
