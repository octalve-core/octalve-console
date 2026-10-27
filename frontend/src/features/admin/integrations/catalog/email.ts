import type {Integration} from "./types";
/** Vendor requirements; no credentials are accepted or transmitted here. */
export const email:readonly Integration[]=[
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
