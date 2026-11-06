import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const hosting:readonly Integration[]=[
 {
  "slug": "opanel",
  "name": "Octalve OPanel",
  "category": "Hosting",
  "summary": "Octalve’s hosting control panel for customers with active, verified hosting services.",
  "documentation": "https://github.com/octalve-core/octalve-opanel/blob/main/README.md",
  "guide": "OPanel architecture, secure SSO and readiness",
  "requirements": [
   {
    "label": "OPanel HTTPS origin",
    "guidance": "Use the live HTTPS address of your OPanel service."
   },
   {
    "label": "Customer entry URL",
    "guidance": "Customers open OPanel from their active hosting service in Octalve Cloud."
   },
   {
    "label": "Callback URL",
    "guidance": "Enter the approved return address for secure sign-in."
   },
   {
    "label": "Confidential client ID",
    "guidance": "Use the client ID assigned to Octalve Cloud and OPanel."
   },
   {
    "label": "Service-to-service client secret",
    "guidance": "Use a dedicated secret for the Octalve Cloud–OPanel connection. Keep it confidential.",
    "sensitive": true
   },
   {
    "label": "Verified hosting account binding",
    "guidance": "Confirm that every hosting account belongs to the customer and is active before allowing access."
   }
  ],
  "capabilities": [
   "Customers can access their hosting dashboard when their service is active and verified.",
   "File management, backups, DNS and other hosting actions become available only after approval.",
   "Hosting access, ownership and billing remain managed by Octalve Cloud."
  ],
  "logo": "opanel",
  "stage": "Read-only"
 },
 {
  "slug": "directadmin",
  "name": "DirectAdmin",
  "category": "Hosting",
  "summary": "Connect your DirectAdmin server or reseller account to manage hosting services.",
  "documentation": "https://docs.directadmin.com/developer/api/",
  "guide": "DirectAdmin API and Login Keys",
  "requirements": [
   {
    "label": "Server URL",
    "guidance": "Enter your DirectAdmin server’s secure URL (HTTPS)."
   },
   {
    "label": "Reseller username",
    "guidance": "Enter the username for your authorized reseller account."
   },
   {
    "label": "Login Key",
    "guidance": "Generate a restricted Login Key in DirectAdmin; do not use your main password.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "View hosting packages once provider access has been verified.",
   "Hosting account creation and changes require separate approval."
  ],
  "stage": "Read-only"
 },
 {
  "slug": "cpanel-whm",
  "name": "cPanel / WHM",
  "category": "Hosting",
  "summary": "Connect your WHM reseller or server account to manage hosting services.",
  "documentation": "https://docs.cpanel.net/whm/development/manage-api-tokens-in-whm/",
  "guide": "WHM → Development → Manage API Tokens",
  "requirements": [
   {
    "label": "WHM URL",
    "guidance": "Enter the HTTPS address of your WHM server."
   },
   {
    "label": "WHM username",
    "guidance": "Enter the username of your authorized WHM account."
   },
   {
    "label": "API token",
    "guidance": "Create a restricted token in WHM. Do not grant full account permissions.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Review hosting packages when the server connection is verified.",
   "Creating or changing hosting accounts requires separate approval."
  ],
  "logo": "cpanel",
  "stage": "Read-only"
 },
 {
  "slug": "plesk",
  "name": "Plesk",
  "category": "Hosting",
  "summary": "Connect a Plesk server to manage eligible hosting subscriptions.",
  "documentation": "https://docs.plesk.com/en-US/obsidian/api-rpc/about-xml-api.28709/",
  "guide": "Plesk XML API documentation",
  "requirements": [
   {
    "label": "Plesk server",
    "guidance": "Enter the full HTTPS address of your Plesk panel."
   },
   {
    "label": "API key",
    "guidance": "Generate an API key for the authorized Plesk account.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Hosting subscription management is not available until the Plesk connection is approved."
  ],
  "logo": "plesk",
  "stage": "Research"
 }
];
