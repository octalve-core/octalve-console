import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const hosting:readonly Integration[]=[
 {
  "slug": "opanel",
  "name": "Octalve OPanel",
  "category": "Hosting",
  "summary": "Octalve's own hosting control panel. Console controls customer identity, paid services and access; OPanel manages approved technical capabilities.",
  "documentation": "https://github.com/octalve-core/octalve-opanel/blob/main/README.md",
  "guide": "OPanel architecture, secure SSO and readiness",
  "requirements": [
   {
    "label": "OPanel HTTPS origin",
    "guidance": "Deploy and verify the independent OPanel application. Use its real HTTPS origin only, not the Console URL or a placeholder."
   },
   {
    "label": "Customer entry URL",
    "guidance": "OPanel GET /auth/start/?service_id=<owned-hosting-service-id>; accessible only after Console confirms ownership, paid active service and provider-backed provisioning."
   },
   {
    "label": "Callback URL",
    "guidance": "Use the exact OPanel HTTPS /auth/callback/ URL in OPANEL_CALLBACK_URL on Console and OPanel; do not allow arbitrary redirects."
   },
   {
    "label": "Confidential client ID",
    "guidance": "Match OPANEL_CLIENT_ID on both applications (default octalve-opanel)."
   },
   {
    "label": "Service-to-service client secret",
    "guidance": "Generate a unique 32+ character secret and set OPANEL_CLIENT_SECRET in both backend secret stores. Never send it to browsers or paste it into this Store.",
    "sensitive": true
   },
   {
    "label": "Verified hosting account binding",
    "guidance": "Require Console provider API readback, exact owner/service match, verified active status and a fresh single-use SSO exchange before technical access."
   }
  ],
  "capabilities": [
   "First-party service-bound SSO and read-only dashboard have source implementations",
   "Files, backups, DNS, SSL and website actions remain separately certified technical capabilities",
   "OPanel cannot override Console subscription, ownership or billing authority",
   "Technical provisioning and Production credential submission remain disabled until live security certification"
  ],
  "logo": "opanel",
  "stage": "Read-only"
 },
 {
  "slug": "directadmin",
  "name": "DirectAdmin",
  "category": "Hosting",
  "summary": "Connect an approved DirectAdmin reseller/server.",
  "documentation": "https://docs.directadmin.com/developer/api/",
  "guide": "DirectAdmin API and Login Keys",
  "requirements": [
   {
    "label": "Server URL",
    "guidance": "Approved HTTPS host on port 2222 or 443"
   },
   {
    "label": "Reseller username",
    "guidance": "Authorized account identity"
   },
   {
    "label": "Login Key",
    "guidance": "Create a command/IP-scoped API Login Key, not your main password",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Package inventory exists",
   "Live account provisioning requires qualification"
  ],
  "stage": "Read-only"
 },
 {
  "slug": "cpanel-whm",
  "name": "cPanel / WHM",
  "category": "Hosting",
  "summary": "Manage accounts using an eligible WHM reseller or server.",
  "documentation": "https://docs.cpanel.net/whm/development/manage-api-tokens-in-whm/",
  "guide": "WHM → Development → Manage API Tokens",
  "requirements": [
   {
    "label": "WHM URL",
    "guidance": "Approved HTTPS server host on port 2087 or 443"
   },
   {
    "label": "WHM username",
    "guidance": "Authorized reseller identity"
   },
   {
    "label": "API token",
    "guidance": "Restrict ACL and avoid the Everything permission",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Package inventory exists",
   "OPanel vendor-backed writes are not qualified"
  ],
  "logo": "cpanel",
  "stage": "Read-only"
 },
 {
  "slug": "plesk",
  "name": "Plesk",
  "category": "Hosting",
  "summary": "Manage eligible Plesk hosting subscriptions.",
  "documentation": "https://docs.plesk.com/en-US/obsidian/api-rpc/about-xml-api.28709/",
  "guide": "Plesk XML API documentation",
  "requirements": [
   {
    "label": "Plesk server",
    "guidance": "Approved panel URL and version"
   },
   {
    "label": "API key",
    "guidance": "Authorized account key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Subscription management requires an approved versioned adapter"
  ],
  "logo": "plesk",
  "stage": "Research"
 }
];
