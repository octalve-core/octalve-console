import { kbArticles } from "@/lib/platform-data";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const htmlByTitle: Record<string, string> = {
  "Getting Started with Octalve Cloud": `
    <h2>Welcome to Octalve Cloud</h2>
    <p>This article explains how to set up your Octalve Console account, order your first hosting plan and understand the client workspace.</p>
    <p>Start from the client dashboard, choose a service package, complete checkout and track your service activation from the services page.</p>
    <ul>
      <li>Create or sign in to your account.</li>
      <li>Select a hosting, domain, SSL, email or backup package.</li>
      <li>Complete checkout using Paystack, Flutterwave, wallet or manual payment.</li>
      <li>Track provisioning from your service page.</li>
    </ul>
  `,
  "How to Point Your Domain to Our Servers": `
    <h2>Pointing your domain</h2>
    <p>To connect your domain, update your nameservers or DNS records from your registrar dashboard.</p>
    <p>When Cloudflare or a registrar adapter is connected, Octalve Console will later allow DNS actions directly from the client portal.</p>
  `,
  "How to Pay Your Invoice": `
    <h2>Paying invoices</h2>
    <p>Invoices can be paid through enabled payment gateways, wallet balance, bank transfer or manual confirmation.</p>
    <p>After payment is confirmed by webhook or admin approval, the related order moves into the provisioning queue.</p>
  `,
  "How to Request Website Migration": `
    <h2>Migration request</h2>
    <p>You can request migration from your support page or service page. Provide old hosting login, WordPress admin access where needed and preferred migration time.</p>
  `,
  "How Hosting Usage Works": `
    <h2>Hosting usage</h2>
    <p>Disk, bandwidth, email, database and backup usage help you understand your hosting limits.</p>
    <p>The final implementation should fetch this from DirectAdmin, cPanel, Plesk or Enhance adapters.</p>
  `,
  "Managing VPS Power Actions": `
    <h2>VPS power actions</h2>
    <p>VPS services should support start, stop, reboot, usage, snapshots and password reset depending on the provider adapter.</p>
  `
};

export const knowledgeBaseArticles = kbArticles.map((article) => ({
  ...article,
  id: slugify(article.title),
  status: "Published" as const,
  visibility: article.category === "VPS" ? "Client" : "Public",
  author: "Octalve Support",
  updatedAt: "May 2026",
  htmlContent:
    htmlByTitle[article.title] ||
    `<p>${article.excerpt}</p><p>This article will be expanded by the support team.</p>`,
  content: [
    `This guide explains ${article.title.toLowerCase()} for Octalve Cloud customers and staff.`,
    "It is prepared as a frontend-ready knowledge base article and will later be connected to the Django knowledge base API.",
    "The final backend implementation should support article categories, publishing status, author, views, likes, SEO title, rich-text content, attachments and audit logs.",
    "For customers, the article should be read-only. For admins, the article should support create, edit, publish, unpublish and delete actions."
  ]
}));

export function getKnowledgeBaseArticle(id: string) {
  return knowledgeBaseArticles.find((article) => article.id === id) || knowledgeBaseArticles[0];
}
