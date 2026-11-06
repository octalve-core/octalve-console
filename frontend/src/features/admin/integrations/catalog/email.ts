import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const email:readonly Integration[]=[
 {
  "slug": "brevo",
  "name": "Brevo",
  "category": "Business email",
  "summary": "Connect Brevo to send transactional account and order notifications.",
  "documentation": "https://developers.brevo.com/reference/quickstart-reference",
  "guide": "Brevo API setup and verified sender domains",
  "requirements": [
   {
    "label": "Brevo account and API URL",
    "guidance": "Use your Brevo business account and its official API access."
   },
   {
    "label": "API key",
    "guidance": "Create a dedicated API key in Brevo and save it only in the secure connection form.",
    "sensitive": true
   },
   {
    "label": "Sending domain",
    "guidance": "Verify the domain used to send emails in your Brevo account."
   },
   {
    "label": "Verified From address",
    "guidance": "Choose and verify your business sender email address."
   },
   {
    "label": "Transactional event notifications",
    "guidance": "Enable delivery-status notifications only when the receiving service is ready."
   }
  ],
  "capabilities": [
   "Supports account and billing notifications once delivery is verified.",
   "This service does not create customer email inboxes or enable marketing campaigns.",
   "Octalve’s current account-verification email is configured separately with Resend."
  ],
  "stage": "Research"
 },
 {
  "slug": "zoho-mail",
  "name": "Zoho Mail",
  "category": "Business email",
  "summary": "Offer business email accounts through an eligible Zoho Mail organization.",
  "documentation": "https://www.zoho.com/mail/help/api/using-oauth-2.html",
  "guide": "Zoho Mail OAuth setup",
  "requirements": [
   {
    "label": "Partner/admin eligibility",
    "guidance": "Confirm your Zoho account can manage the required organizations."
   },
   {
    "label": "Organization ID",
    "guidance": "Copy the organization ID from your Zoho Mail admin account."
   },
   {
    "label": "OAuth refresh token",
    "guidance": "Use the authorized connection credentials issued for your organization.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Mailbox creation requires approved organization or partner permissions."
  ],
  "logo": "zoho",
  "stage": "Research"
 },
 {
  "slug": "google-workspace",
  "name": "Google Workspace",
  "category": "Business email",
  "summary": "Manage Google Workspace subscriptions through an approved reseller account.",
  "documentation": "https://developers.google.com/workspace/admin/reseller/v1/how-tos/prerequisites",
  "guide": "Google Reseller API prerequisites",
  "requirements": [
   {
    "label": "Reseller contract",
    "guidance": "Confirm your Google Workspace reseller status."
   },
   {
    "label": "Customer account",
    "guidance": "Provide the customer’s authorized Workspace account details."
   },
   {
    "label": "OAuth identity",
    "guidance": "Use credentials authorized for your reseller account.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Subscription management requires Google reseller authorization."
  ],
  "logo": "googlecloud",
  "stage": "Research"
 },
 {
  "slug": "microsoft-365",
  "name": "Microsoft 365",
  "category": "Business email",
  "summary": "Manage Microsoft 365 business subscriptions through an authorized partner account.",
  "documentation": "https://learn.microsoft.com/en-us/partner-center/developer/get-started",
  "guide": "Microsoft Partner Center API setup",
  "requirements": [
   {
    "label": "CSP relationship",
    "guidance": "Confirm your Microsoft partner account is eligible."
   },
   {
    "label": "Entra tenant",
    "guidance": "Enter your authorized Microsoft tenant details."
   },
   {
    "label": "OAuth authority",
    "guidance": "Use the approved application credentials for your partner account.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Microsoft 365 subscriptions require approved partner access.",
   "Saving connection details does not create customer subscriptions."
  ],
  "stage": "Research"
 },
 {
  "slug": "resend",
  "name": "Resend",
  "category": "Business email",
  "summary": "Send customer verification emails and service notifications with Resend.",
  "documentation": "https://resend.com/docs/dashboard/api-keys/introduction",
  "guide": "Resend API-key setup",
  "requirements": [
   {
    "label": "Sender domain",
    "guidance": "Add and verify your sending domain in Resend."
   },
   {
    "label": "API key",
    "guidance": "Create an API key with the permissions required for sending email.",
    "sensitive": true
   }
  ],
  "capabilities": [
   "Supports account and order notifications after sender verification.",
   "Resend is not a business mailbox hosting service."
  ],
  "logo": "resend",
  "stage": "Research"
 }
];
