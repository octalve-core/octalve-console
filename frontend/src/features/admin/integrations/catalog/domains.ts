import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const domains:readonly Integration[]=[
 {
  "slug": "resellerclub",
  "name": "ResellerClub",
  "category": "Domains",
  "summary": "Wholesale registration and renewal for authorized domain resellers.",
  "documentation": "https://manage.resellerclub.com/kb/answer/753",
  "guide": "Find Reseller ID and API key",
  "requirements": [
   {
    "label": "Reseller ID",
    "guidance": "Control panel → Manage Profile"
   },
   {
    "label": "Environment",
    "guidance": "Sandbox or Live"
   },
   {
    "label": "API key",
    "guidance": "Control panel → Settings → API",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Registration requires funded reseller approval",
   "No live domain purchases from the store"
  ],
  "stage": "Research"
 },
 {
  "slug": "namecheap",
  "name": "Namecheap",
  "category": "Domains",
  "summary": "Domain APIs for eligible authorized accounts.",
  "documentation": "https://www.namecheap.com/support/api/intro/",
  "guide": "Namecheap API introduction",
  "requirements": [
   {
    "label": "API username",
    "guidance": "Exact eligible Namecheap account"
   },
   {
    "label": "Allowed outbound IP",
    "guidance": "Whitelisted client address"
   },
   {
    "label": "API key",
    "guidance": "Authorized domain API key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Registration and transfers need API qualification"
  ],
  "logo": "namecheap",
  "stage": "Research"
 },
 {
  "slug": "opensrs",
  "name": "OpenSRS",
  "category": "Domains",
  "summary": "Domain resale using approved OpenSRS credentials.",
  "documentation": "https://opensrs.com/integrations/",
  "guide": "OpenSRS API integration options",
  "requirements": [
   {
    "label": "Reseller username",
    "guidance": "Authorized reseller identity"
   },
   {
    "label": "Allowed IP",
    "guidance": "Permitted API caller"
   },
   {
    "label": "API key",
    "guidance": "Reseller API key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Wholesale operations subject to contracted API permissions"
  ],
  "stage": "Research"
 },
 {
  "slug": "cloudflare-registrar",
  "name": "Cloudflare Registrar",
  "category": "Domains",
  "summary": "Limited Registrar API beta, not a certified wholesale reseller.",
  "documentation": "https://developers.cloudflare.com/registrar/registrar-api/",
  "guide": "Registrar API beta guide",
  "requirements": [
   {
    "label": "Account ID",
    "guidance": "Eligible Cloudflare account"
   },
   {
    "label": "Registrant profile",
    "guidance": "Verified registrant details and agreement"
   },
   {
    "label": "Registrar token",
    "guidance": "Scoped Registrar write authorization",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Beta features only; resale rights not established"
  ],
  "logo": "cloudflare",
  "stage": "Research"
 }
];
