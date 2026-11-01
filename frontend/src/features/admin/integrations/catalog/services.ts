import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const services:readonly Integration[]=[
 {
  "slug": "cloudflare-dns",
  "name": "Cloudflare DNS",
  "category": "DNS & SSL",
  "summary": "Read-only DNS zone and record verification through a fixed Cloudflare API origin. Never grants DNS changes automatically.",
  "documentation": "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
  "guide": "Cloudflare → Create API token",
  "requirements": [
   {
    "label": "Zone ID",
    "guidance": "Verified DNS zone ownership"
   },
   {
    "label": "Account ID",
    "guidance": "Approved account"
   },
   {
    "label": "API token",
    "guidance": "Create an API token with Zone: Read and DNS: Read permissions restricted to an owned zone. Configure INT01_CLOUDFLARE_DNS_TOKEN only in approved backend secret storage. Never paste credentials here.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "INT-01 has a source-tested zone ownership and DNS-record digest probe; real connection is not certified until authenticated Cloudflare readback succeeds",
   "Run operator-only int01_cloudflare_probe --scope dns --zone-id <owned-zone-id> with approved secret-store configuration",
   "No record writes, nameserver changes or registrar purchases are enabled"
  ],
  "logo": "cloudflare",
  "stage": "Read-only"
 },
 {
  "slug": "letsencrypt",
  "name": "Let's Encrypt",
  "category": "DNS & SSL",
  "summary": "Free ACME certificate issuance on qualified hosting environments.",
  "documentation": "https://letsencrypt.org/docs/",
  "guide": "ACME and domain-validation guide",
  "requirements": [
   {
    "label": "Domain validation",
    "guidance": "HTTP-01 or DNS-01 authority"
   },
   {
    "label": "ACME account",
    "guidance": "Trusted server-side ACME identity"
   },
   {
    "label": "Installer",
    "guidance": "Supported hosting panel or OPanel native agent"
   }
  ],
  "capabilities": [
   "Issuance and renewals require staging acceptance"
  ],
  "logo": "letsencrypt",
  "stage": "Research"
 },
 {
  "slug": "paystack",
  "name": "Paystack",
  "category": "Payments",
  "summary": "Merchant checkout and verified settlement through existing financial authority.",
  "documentation": "https://support.paystack.com/en/articles/2123458",
  "guide": "Dashboard API Keys & Webhooks",
  "requirements": [
   {
    "label": "Merchant identity",
    "guidance": "Approved business account"
   },
   {
    "label": "Environment",
    "guidance": "Test or Live"
   },
   {
    "label": "Secret key",
    "guidance": "Backend-only merchant secret",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Console's existing PaymentGateway remains authoritative",
   "Not activated by this catalogue"
  ],
  "stage": "Research"
 },
 {
  "slug": "flutterwave",
  "name": "Flutterwave",
  "category": "Payments",
  "summary": "Payment gateway and webhook verification after merchant approval.",
  "documentation": "https://developer.flutterwave.com/docs",
  "guide": "Flutterwave developer guide",
  "requirements": [
   {
    "label": "Merchant account",
    "guidance": "Eligible API account"
   },
   {
    "label": "API version",
    "guidance": "Pin vendor contract"
   },
   {
    "label": "Secret key",
    "guidance": "Vendor-specific merchant credential",
    "sensitive": true
   }
  ],
  "capabilities": [
   "No payments may be marked paid from callbacks alone"
  ],
  "stage": "Research"
 },
 {
  "slug": "monnify",
  "name": "Monnify",
  "category": "Payments",
  "summary": "Business bank-transfer checkout and verified payment confirmation.",
  "documentation": "https://developers.monnify.com/",
  "guide": "Monnify API documentation",
  "requirements": [
   {
    "label": "Merchant account",
    "guidance": "Eligible Monnify merchant"
   },
   {
    "label": "API key",
    "guidance": "Issued merchant API key",
    "sensitive": true
   },
   {
    "label": "API secret",
    "guidance": "Issued merchant secret",
    "sensitive": true
   }
  ],
  "capabilities": [
   "No screenshots as proof of payment"
  ],
  "stage": "Research"
 }
];
