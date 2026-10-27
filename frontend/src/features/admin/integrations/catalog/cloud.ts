import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const cloud:readonly Integration[]=[
 {
  "slug": "hetzner",
  "name": "Hetzner Cloud",
  "category": "Cloud & VPS",
  "summary": "Cloud VPS infrastructure on authorized Hetzner projects.",
  "documentation": "https://docs.hetzner.com/cloud/api/getting-started/generating-api-token/",
  "guide": "Generate Hetzner Cloud API token",
  "requirements": [
   {
    "label": "Project",
    "guidance": "Authorized cloud project"
   },
   {
    "label": "Region",
    "guidance": "Approved resource policy"
   },
   {
    "label": "API token",
    "guidance": "Project-scoped cloud key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "VM creation incurs provider costs",
   "Hosted panel account lifecycle is separate"
  ],
  "logo": "hetzner",
  "stage": "Research"
 },
 {
  "slug": "digitalocean",
  "name": "DigitalOcean",
  "category": "Cloud & VPS",
  "summary": "Manage cloud compute resources under an approved account.",
  "documentation": "https://docs.digitalocean.com/reference/api/create-personal-access-token/",
  "guide": "Create scoped DigitalOcean token",
  "requirements": [
   {
    "label": "Account/team",
    "guidance": "Correct infrastructure tenant"
   },
   {
    "label": "Scopes",
    "guidance": "Limited permissions"
   },
   {
    "label": "API token",
    "guidance": "Scoped provider key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Droplets are not customer shared-hosting accounts"
  ],
  "logo": "digitalocean",
  "stage": "Research"
 },
 {
  "slug": "proxmox",
  "name": "Proxmox VE",
  "category": "Cloud & VPS",
  "summary": "Virtual machines on a Proxmox cluster we control.",
  "documentation": "https://pve.proxmox.com/pve-docs/api-viewer/index.html",
  "guide": "Proxmox VE API reference",
  "requirements": [
   {
    "label": "Cluster URL",
    "guidance": "Approved Proxmox endpoint"
   },
   {
    "label": "Token ID",
    "guidance": "user@realm!token"
   },
   {
    "label": "Token secret",
    "guidance": "Privilege-separated token",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Cluster ACLs and node ownership require qualification"
  ],
  "logo": "proxmox",
  "stage": "Research"
 },
 {
  "slug": "vultr",
  "name": "Vultr",
  "category": "Cloud & VPS",
  "summary": "Cloud resources under a qualified Vultr account.",
  "documentation": "https://www.vultr.com/api/",
  "guide": "Vultr API documentation",
  "requirements": [
   {
    "label": "Cloud account",
    "guidance": "Approved merchant account"
   },
   {
    "label": "API key",
    "guidance": "Server-side restricted key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Supplier costs and account limits must be reconciled"
  ],
  "logo": "vultr",
  "stage": "Research"
 },
 {
  "slug": "cloudflare-r2",
  "name": "Cloudflare R2",
  "category": "Storage",
  "summary": "Private object storage for encrypted backups.",
  "documentation": "https://developers.cloudflare.com/r2/get-started/s3/",
  "guide": "R2 S3 key and bucket setup",
  "requirements": [
   {
    "label": "Account ID",
    "guidance": "Cloudflare R2 account"
   },
   {
    "label": "Bucket",
    "guidance": "Private bucket scope"
   },
   {
    "label": "Access key ID",
    "guidance": "R2 S3 access key"
   },
   {
    "label": "Secret access key",
    "guidance": "R2 S3 secret; not a DNS token",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Restore and immutable retention must be tested"
  ],
  "logo": "cloudflare",
  "stage": "Research"
 }
];
