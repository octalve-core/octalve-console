import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const services:readonly Integration[]=[
 {
  "slug": "cloudflare-dns",
  "name": "Cloudflare DNS",
  "category": "DNS & SSL",
  "summary": "Connect Cloudflare to verify your domain and review its DNS records safely.",
  "documentation": "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
  "guide": "Cloudflare → Create API token",
  "requirements": [
   {
    "label": "Zone ID",
    "guidance": "Cloudflare → Your domain → Overview → API → Copy Zone ID."
   },
   {
    "label": "Account ID",
    "guidance": "Cloudflare → Account Home → Copy Account ID."
   },
   {
    "label": "API token",
    "guidance": "Create a custom API token with Zone Read and DNS Read for this domain. Paste the token itself into the secure connection form, not its ID or the example command."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Verify that the selected domain belongs to your Cloudflare account.",
   "Review DNS records without editing them.",
   "DNS changes and domain purchases require separate approval."
  ],
  "logo": "cloudflare",
  "stage": "Read-only"
 },
 {
  "slug": "letsencrypt",
  "name": "Let's Encrypt",
  "category": "DNS & SSL",
  "summary": "Set up free SSL certificates for approved domains and hosting services.",
  "documentation": "https://letsencrypt.org/docs/",
  "guide": "ACME and domain-validation guide",
  "requirements": [
   {
    "label": "Domain validation",
    "guidance": "Confirm you control the website or its DNS settings."
   },
   {
    "label": "ACME account",
    "guidance": "Use an approved account for SSL certificates."
   },
   {
    "label": "Installer",
    "guidance": "Select the hosting control panel or server that will install the certificate."
   }
  ],
  "capabilities": [
   "Certificate issuance and renewal are available only after the hosting service is connected and approved."
  ],
  "logo": "letsencrypt",
  "stage": "Research"
 },
 {
  "slug": "paystack",
  "name": "Paystack",
  "category": "Payments",
  "summary": "Connect Paystack to accept customer payments and confirm successful transactions.",
  "documentation": "https://support.paystack.com/en/articles/2123458",
  "guide": "Dashboard API Keys & Webhooks",
  "requirements": [
   {
    "label": "Merchant identity",
    "guidance": "Use your approved Paystack business account."
   },
   {
    "label": "Environment",
    "guidance": "Choose test or live credentials for the correct account."
   },
   {
    "label": "Secret key",
    "guidance": "Copy the appropriate secret key from Paystack’s dashboard and keep it confidential."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Payment processing uses Octalve Cloud’s approved payment settings.",
   "Saving a connection does not enable payments automatically."
  ],
  "stage": "Research"
 },
 {
  "slug": "flutterwave",
  "name": "Flutterwave",
  "category": "Payments",
  "summary": "Connect Flutterwave to collect customer payments securely.",
  "documentation": "https://developer.flutterwave.com/docs",
  "guide": "Flutterwave developer guide",
  "requirements": [
   {
    "label": "Merchant account",
    "guidance": "Use your authorized Flutterwave business account."
   },
   {
    "label": "API version",
    "guidance": "Confirm the supported API version in your Flutterwave account."
   },
   {
    "label": "Secret key",
    "guidance": "Create a secret key for the correct test or live environment."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Transactions must be confirmed by the payment provider before orders are marked paid.",
   "Payment collection is available only after approval."
  ],
  "stage": "Research"
 },
 {
  "slug": "monnify",
  "name": "Monnify",
  "category": "Payments",
  "summary": "Connect Monnify for bank-transfer payments and payment confirmation.",
  "documentation": "https://developers.monnify.com/",
  "guide": "Monnify API documentation",
  "requirements": [
   {
    "label": "Merchant account",
    "guidance": "Use your approved Monnify merchant account."
   },
   {
    "label": "API key",
    "guidance": "Copy the API key from your Monnify account."
    "sensitive": true
   },
   {
    "label": "API secret",
    "guidance": "Copy the matching API secret and keep it confidential."
    "sensitive": true
   }
  ],
  "capabilities": [
   "Customer payments must be verified through Monnify before orders are marked paid.",
   "Payment processing remains unavailable until the merchant account is approved."
  ],
  "stage": "Research"
 }
];
