import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const hosting:readonly Integration[]=[
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
