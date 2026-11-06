import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const cloud:readonly Integration[]=[
 {
  "slug": "hetzner",
  "name": "Hetzner Cloud",
  "category": "Cloud & VPS",
  "summary": "Connect a Hetzner Cloud project to manage virtual servers.",
  "documentation": "https://docs.hetzner.com/cloud/api/getting-started/generating-api-token/",
  "guide": "Generate Hetzner Cloud API token",
  "requirements": [
   {
    "label": "Project",
    "guidance": "Choose the Hetzner Cloud project you control."
   },
   {
    "label": "Region",
    "guidance": "Select the locations allowed for this account."
   },
   {
    "label": "API token",
    "guidance": "Create an access token for the selected project."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Creating cloud servers may incur supplier charges.",
   "Server creation requires separate approval."
  ],
  "logo": "hetzner",
  "stage": "Research"
 },
 {
  "slug": "digitalocean",
  "name": "DigitalOcean",
  "category": "Cloud & VPS",
  "summary": "Connect a DigitalOcean team to manage cloud servers.",
  "documentation": "https://docs.digitalocean.com/reference/api/create-personal-access-token/",
  "guide": "Create scoped DigitalOcean token",
  "requirements": [
   {
    "label": "Account/team",
    "guidance": "Select the DigitalOcean team that owns your resources."
   },
   {
    "label": "Scopes",
    "guidance": "Grant only the permissions required for approved operations."
   },
   {
    "label": "API token",
    "guidance": "Create a token in DigitalOcean for the selected team."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Cloud servers are managed separately from shared-hosting accounts.",
   "New server creation requires separate approval."
  ],
  "logo": "digitalocean",
  "stage": "Research"
 },
 {
  "slug": "proxmox",
  "name": "Proxmox VE",
  "category": "Cloud & VPS",
  "summary": "Connect your Proxmox cluster to manage virtual machines.",
  "documentation": "https://pve.proxmox.com/pve-docs/api-viewer/index.html",
  "guide": "Proxmox VE API reference",
  "requirements": [
   {
    "label": "Cluster URL",
    "guidance": "Enter the secure URL of your Proxmox server."
   },
   {
    "label": "Token ID",
    "guidance": "Enter the token identifier issued by Proxmox."
   },
   {
    "label": "Token secret",
    "guidance": "Enter the matching token secret, not your main account password."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Virtual-machine access requires verified server ownership and permissions.",
   "Creating or changing machines requires separate approval."
  ],
  "logo": "proxmox",
  "stage": "Research"
 },
 {
  "slug": "vultr",
  "name": "Vultr",
  "category": "Cloud & VPS",
  "summary": "Connect your Vultr account to manage cloud resources.",
  "documentation": "https://www.vultr.com/api/",
  "guide": "Vultr API documentation",
  "requirements": [
   {
    "label": "Cloud account",
    "guidance": "Use your authorized Vultr account."
   },
   {
    "label": "API key",
    "guidance": "Create a restricted API key in the Vultr account dashboard."
    "sensitive": true
   }
  ],
  "capabilities": [
   "New cloud resources may incur provider charges.",
   "Resource creation requires separate approval."
  ],
  "logo": "vultr",
  "stage": "Research"
 },
 {
  "slug": "cloudflare-r2",
  "name": "Cloudflare R2",
  "category": "Storage",
  "summary": "Connect Cloudflare R2 to store private files and encrypted backups.",
  "documentation": "https://developers.cloudflare.com/r2/get-started/s3/",
  "guide": "R2 S3 key and bucket setup",
  "requirements": [
   {
    "label": "Account ID",
    "guidance": "Copy your Cloudflare Account ID."
   },
   {
    "label": "Bucket",
    "guidance": "Enter the name of your private R2 bucket."
   },
   {
    "label": "Access key ID",
    "guidance": "Use an access key issued for the selected R2 bucket."
   },
   {
    "label": "Secret access key",
    "guidance": "Enter the matching R2 secret key. A Cloudflare DNS token will not work."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Backup storage and recovery must be verified before production use.",
   "Saving storage credentials does not activate backups automatically."
  ],
  "logo": "cloudflare",
  "stage": "Research"
 }
];
