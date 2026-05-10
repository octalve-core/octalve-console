export type ClientKnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  actionHref: string;
};

export const clientKnowledgeArticles: ClientKnowledgeArticle[] = [
  {
    id: "kb-domain-dns",
    title: "How to point your domain to Octalve hosting",
    category: "Domains",
    excerpt: "Learn how to update nameservers and DNS records for your website.",
    content: "To connect your domain, update your nameservers or DNS A record to point to your Octalve hosting service. After updating DNS, allow propagation time before testing your website.",
    actionHref: "/client/knowledge-base/kb-domain-dns",
  },
  {
    id: "kb-invoice-payment",
    title: "How invoices and renewals work",
    category: "Billing",
    excerpt: "Understand due dates, payment confirmation, and renewal workflow.",
    content: "Invoices are generated for orders, renewals, and service upgrades. Paid invoices keep your services active. If manual payment is enabled, upload or send payment confirmation for admin approval.",
    actionHref: "/client/knowledge-base/kb-invoice-payment",
  },
  {
    id: "kb-support",
    title: "How to open a support ticket",
    category: "Support",
    excerpt: "Create a support request for DNS, hosting, email, billing, or provisioning.",
    content: "Open a ticket from your client dashboard, select the correct department, provide a clear subject and describe your issue. Support will respond inside the ticket thread.",
    actionHref: "/client/knowledge-base/kb-support",
  },
];