export type ClientOrderPlan = {
  id: string;
  name: string;
  product: string;
  description: string;
  price: number;
  cycle: string;
  features: string[];
  popular?: boolean;
};

export const clientOrderPlans: ClientOrderPlan[] = [
  {
    id: "web-business",
    name: "Business Hosting",
    product: "Web Hosting",
    description: "Fast shared hosting for business websites, landing pages, and company emails.",
    price: 3500,
    cycle: "monthly",
    popular: true,
    features: ["10GB SSD storage", "5 email accounts", "Free SSL", "Weekly backups"],
  },
  {
    id: "vps-starter",
    name: "VPS Starter",
    product: "VPS Hosting",
    description: "Dedicated cloud resources for apps, panels, APIs, and growing websites.",
    price: 12000,
    cycle: "monthly",
    features: ["2 vCPU", "4GB RAM", "80GB SSD", "Managed setup option"],
  },
  {
    id: "email-pro",
    name: "Business Email",
    product: "Email Hosting",
    description: "Professional email for teams using your own business domain.",
    price: 2000,
    cycle: "monthly",
    features: ["Custom domain email", "Spam protection", "Webmail access", "Mobile ready"],
  },
];