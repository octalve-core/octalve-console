import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const email:readonly Integration[]=[
 {
  "slug": "brevo",
  "name": "Brevo",
  "category": "Business email",
  "summary": "Transactional account emails, verification, order notifications and delivery tracking; not customer mailbox hosting.",
  "documentation": "https://developers.brevo.com/reference/quickstart-reference",
  "guide": "Brevo API setup and verified sender domains",
  "requirements": [
   {
    "label": "Brevo account and API URL",
    "guidance": "Create a Brevo business account. Official API base: https://api.brevo.com/v3. A read-only connection probe can use GET /v3/account."
   },
   {
    "label": "API key",
    "guidance": "In Brevo SMTP & API settings, create a dedicated transactional-email API key; keep it server-side. Do not enter it in the browser until approved Console credential custody is enabled.",
    "sensitive": true
   },
   {
    "label": "Sending domain",
    "guidance": "Add the company sending domain and publish the exact Brevo-provided DNS authentication records (DKIM/DMARC and verification) before sending."
   },
   {
    "label": "Verified From address",
    "guidance": "Choose a working support or notifications mailbox on your authenticated domain and verify the sender."
   },
   {
    "label": "Transactional event notifications",
    "guidance": "Configure a dedicated HTTPS delivery-webhook endpoint with authenticated requests and replay protection after the webhook receiver is certified."
   }
  ],
  "capabilities": [
   "A backend secure draft schema already exists for sending_domain and api_key",
   "Transactional messages support registration, password-reset and billing notices when delivery is qualified",
   "Delivery, bounce and complaint events require verified webhook processing",
   "This integration does not provision mailboxes, sell email subscriptions or enable bulk marketing automatically"
  ],
  "stage": "Research"
 },
 {
  "slug": "zoho-mail",
  "name": "Zoho Mail",
  "category": "Business email",
  "summary": "Business mailboxes, partner-managed organizations and domains.",
  "documentation": "https://www.zoho.com/mail/help/api/using-oauth-2.html",
  "guide": "Zoho Mail OAuth setup",
  "requirements": [
   {
    "label": "Partner/admin eligibility",
    "guidance": "Org creation requires partner entitlement"
   },
   {
    "label": "Organization ID",
    "guidance": "Exact tenant"
   },
   {
    "label": "OAuth refresh token",
    "guidance": "Authorized scoped secret",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Mailbox creation subject to organization/partner rights"
  ],
  "logo": "zoho",
  "stage": "Research"
 },
 {
  "slug": "google-workspace",
  "name": "Google Workspace",
  "category": "Business email",
  "summary": "Subscriptions through an authorized Workspace reseller.",
  "documentation": "https://developers.google.com/workspace/admin/reseller/v1/how-tos/prerequisites",
  "guide": "Google Reseller API prerequisites",
  "requirements": [
   {
    "label": "Reseller contract",
    "guidance": "Google-approved reseller status"
   },
   {
    "label": "Customer account",
    "guidance": "Verified Workspace subscriber"
   },
   {
    "label": "OAuth identity",
    "guidance": "Reseller-authorized API scopes",
    "sensitive": true
   }
  ],
  "capabilities": [
   "General Google users do not have reseller authority"
  ],
  "logo": "googlecloud",
  "stage": "Research"
 },
 {
  "slug": "microsoft-365",
  "name": "Microsoft 365",
  "category": "Business email",
  "summary": "Microsoft business-email subscriptions subject to CSP eligibility.",
  "documentation": "https://learn.microsoft.com/en-us/partner-center/developer/get-started",
  "guide": "Microsoft Partner Center API setup",
  "requirements": [
   {
    "label": "CSP relationship",
    "guidance": "Eligible API-authorized partner"
   },
   {
    "label": "Entra tenant",
    "guidance": "Partner tenant and application"
   },
   {
    "label": "OAuth authority",
    "guidance": "MFA-compliant approved application",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Indirect resellers cannot assume Partner Center API access"
  ],
  "stage": "Research"
 },
 {
  "slug": "resend",
  "name": "Resend",
  "category": "Business email",
  "summary": "Transactional notifications; does not sell mailboxes.",
  "documentation": "https://resend.com/docs/dashboard/api-keys/introduction",
  "guide": "Resend API-key setup",
  "requirements": [
   {
    "label": "Sender domain",
    "guidance": "Verified sending domain"
   },
   {
    "label": "API key",
    "guidance": "Sending-scoped provider key",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Notifications only, not hosted customer inboxes"
  ],
  "logo": "resend",
  "stage": "Research"
 }
];
