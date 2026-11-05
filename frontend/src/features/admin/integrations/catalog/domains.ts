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
  "summary": "Registrar API is not a wholesale reseller connection. INT-01 can test the separate, no-charge Cloudflare Registrar Sandbox.",
  "documentation": "https://developers.cloudflare.com/registrar/registrar-api/",
  "guide": "Registrar API beta guide",
  "requirements": [
   {
    "label": "Account ID",
    "guidance": "Cloudflare account identifier (32 hexadecimal characters) for the isolated Registrar Sandbox tests"
   },
   {
    "label": "Registrant profile",
    "guidance": "Verified registrant details and agreement"
   },
   {
    "label": "Registrar token",
    "guidance": "For INT-01 obtain a dedicated Registrar Sandbox-permission API token and keep it in backend secret storage as INT01_CLOUDFLARE_SANDBOX_TOKEN. Do not use a production registrar write token.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Sandbox read-only inventory and availability check use documented Cloudflare API endpoints",
   "Simulated registration requires explicit operator approval and an accepted registrant contact in Cloudflare; no real domains, DNS zones or charges result",
   "Commercial registrar API rights and production registration remain separately gated"
  ],
  "logo": "cloudflare",
  "stage": "Research"
 },
 {
  "slug": "cloudflare-registrar-live",
  "name": "Cloudflare Registrar — Live Quote",
  "category": "Domains",
  "summary": "Scoped live API check for .com and .net availability and supplier prices. Registration and payments remain disabled.",
  "documentation": "https://developers.cloudflare.com/registrar/registrar-api/",
  "guide": "Cloudflare Registrar API beta — live availability checks",
  "requirements": [
   {
    "label": "Cloudflare Account ID",
    "guidance": "Exact 32-character account identifier associated with approved registrar access."
   },
   {
    "label": "Dedicated registrar API token",
    "guidance": "Issue a separate account-scoped token for controlled registrar checks. Never reuse the Cloudflare DNS token.",
    "sensitive": true
   },
   {
    "label": "Independent release approval",
    "guidance": "Save the token in encrypted Octalve provider vault only after individual adapter allowlisting. Enable server-side quote readback separately."
   }
  ],
  "capabilities": [
   "Super Admin password and fresh TOTP required for every live quote",
   "Returned prices are supplier-only, not retail offers or checkout authorizations",
   "No live registration, renewal, payment or nameserver change is possible from this connector"
  ],
  "logo": "cloudflare",
  "stage": "Research"
 }

];
