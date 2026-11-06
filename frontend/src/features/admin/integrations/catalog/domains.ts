import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const domains:readonly Integration[]=[
 {
  "slug": "resellerclub",
  "name": "ResellerClub",
  "category": "Domains",
  "summary": "Connect your ResellerClub account to manage domain registrations and renewals.",
  "documentation": "https://manage.resellerclub.com/kb/answer/753",
  "guide": "Find Reseller ID and API key",
  "requirements": [
   {
    "label": "Reseller ID",
    "guidance": "Find your Reseller ID in ResellerClub → Manage Profile."
   },
   {
    "label": "Environment",
    "guidance": "Choose the matching test or live account."
   },
   {
    "label": "API key",
    "guidance": "Copy the API key from ResellerClub → Settings → API."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Domain purchases require an approved, funded reseller account.",
   "No domain will be purchased when you save the connection."
  ],
  "stage": "Research"
 },
 {
  "slug": "namecheap",
  "name": "Namecheap",
  "category": "Domains",
  "summary": "Connect an eligible Namecheap account for domain services.",
  "documentation": "https://www.namecheap.com/support/api/intro/",
  "guide": "Namecheap API introduction",
  "requirements": [
   {
    "label": "API username",
    "guidance": "Enter the username of your eligible Namecheap account."
   },
   {
    "label": "Allowed outbound IP",
    "guidance": "Add your authorized server’s outgoing IP address to Namecheap’s allowlist."
   },
   {
    "label": "API key",
    "guidance": "Create the API key in Namecheap’s account settings."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Domain registration, renewal and transfer are available only after account approval.",
   "Saving details does not buy or transfer a domain."
  ],
  "logo": "namecheap",
  "stage": "Research"
 },
 {
  "slug": "opensrs",
  "name": "OpenSRS",
  "category": "Domains",
  "summary": "Connect your OpenSRS reseller account to offer domain services.",
  "documentation": "https://opensrs.com/integrations/",
  "guide": "OpenSRS API integration options",
  "requirements": [
   {
    "label": "Reseller username",
    "guidance": "Enter your authorized OpenSRS reseller username."
   },
   {
    "label": "Allowed IP",
    "guidance": "Allow the verified IP address of the server using OpenSRS."
   },
   {
    "label": "API key",
    "guidance": "Use the API key issued for your reseller account."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Domain services require an approved reseller agreement and provider permissions."
  ],
  "stage": "Research"
 },
 {
  "slug": "cloudflare-registrar",
  "name": "Cloudflare Registrar",
  "category": "Domains",
  "summary": "Review domain registration in Cloudflare’s test environment without buying a domain.",
  "documentation": "https://developers.cloudflare.com/registrar/registrar-api/",
  "guide": "Registrar API beta guide",
  "requirements": [
   {
    "label": "Account ID",
    "guidance": "Copy the Account ID from your Cloudflare dashboard."
   },
   {
    "label": "Registrant profile",
    "guidance": "Confirm the domain registration contact details in Cloudflare."
   },
   {
    "label": "Registrar token",
    "guidance": "Use a dedicated Cloudflare Registrar test token, not your DNS token."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Check supported domain names in Cloudflare’s test environment.",
   "Test registrations do not purchase real domains or create live DNS records.",
   "Live purchases require a separate approval."
  ],
  "logo": "cloudflare",
  "stage": "Research"
 },
 {
  "slug": "cloudflare-registrar-live",
  "name": "Cloudflare Registrar — Live Quote",
  "category": "Domains",
  "summary": "Check live .com and .net domain availability and supplier prices through Cloudflare.",
  "documentation": "https://developers.cloudflare.com/registrar/registrar-api/",
  "guide": "Cloudflare Registrar API beta — live availability checks",
  "requirements": [
   {
    "label": "Cloudflare Account ID",
    "guidance": "Copy your Cloudflare Account ID."
   },
   {
    "label": "Dedicated registrar API token",
    "guidance": "Create a separate Cloudflare Registrar token. Do not reuse your DNS token."
    "sensitive": true
   },
   {
    "label": "Independent release approval",
    "guidance": "An authorized Super Admin must approve live price checks before use."
   }
  ],
  "capabilities": [
   "Check supported domain availability and supplier costs once connected.",
   "Supplier prices are not Octalve customer selling prices.",
   "Domain purchases, renewals and nameserver changes remain unavailable."
  ],
  "logo": "cloudflare",
  "stage": "Research"
 }

];
