export type ConsoleBillingCycleKey = "1mo" | "12mo" | "24mo" | "48mo";

export type ConsolePackageCategoryKey =
  | "promos"
  | "domains"
  | "email"
  | "wordpress"
  | "hosting"
  | "security"
  | "vps";

export type ConsolePriceCategory = {
  key: ConsolePackageCategoryKey;
  label: string;
  description: string;
};

export type ConsoleBillingCycle = {
  key: ConsoleBillingCycleKey;
  label: string;
  months: number;
  discountPercent: number;
  badge?: string;
};

export type FixedPricing = {
  kind: "fixed";
  price: number;
  suffix: string;
  regularPrice?: number;
};

export type CyclePricing = {
  kind: "cycle";
  baseMonthlyPrice: number;
  regularMonthlyPrice?: number;
  billingAdjustments?: Partial<Record<ConsoleBillingCycleKey, number>>;
};

export type ConsolePricePlan = {
  id: string;
  name: string;
  category: ConsolePackageCategoryKey;
  badge?: string;
  popular?: boolean;
  eyebrow?: string;
  description: string;
  pricing: FixedPricing | CyclePricing;
  ctaLabel?: string;
  finePrint?: string;
  features: string[];

  /**
   * Console automation metadata.
   * Later, these values should come from the Django catalog/provider API.
   */
  product: string;
  adapter: string;
  providerPackage: string;
  welcomeTemplate: string;
  automationEvent: string;
};

export type PlanPricingDisplay = {
  priceLabel: string;
  suffix: string;
  regularPriceLabel?: string;
  totalLabel?: string;
  renewsLabel?: string;
  discountPercent?: number;
};

export const DEFAULT_CONSOLE_BILLING_CYCLE: ConsoleBillingCycleKey = "12mo";

export const consoleBillingCycles: ConsoleBillingCycle[] = [
  { key: "1mo", label: "1 month", months: 1, discountPercent: 0 },
  { key: "12mo", label: "12 months", months: 12, discountPercent: 10, badge: "Popular" },
  { key: "24mo", label: "24 months", months: 24, discountPercent: 15 },
  { key: "48mo", label: "48 months", months: 48, discountPercent: 20, badge: "Best value" }
];

export const consolePriceCategories: ConsolePriceCategory[] = [
  {
    key: "promos",
    label: "Promos",
    description: "Starter offers and entry products for new online businesses."
  },
  {
    key: "domains",
    label: "Domains",
    description: "Register domains, manage DNS, renewals, nameservers and online identity."
  },
  {
    key: "email",
    label: "Email",
    description: "Professional business email packages for teams, brands and founders."
  },
  {
    key: "wordpress",
    label: "WordPress",
    description: "WordPress-ready hosting for websites, blogs, stores and business pages."
  },
  {
    key: "hosting",
    label: "Hosting",
    description: "Shared hosting packages mapped to DirectAdmin/cPanel-style provider packages."
  },
  {
    key: "security",
    label: "Security",
    description: "SSL certificates, protection, backup support and website security services."
  },
  {
    key: "vps",
    label: "VPS",
    description: "Cloud server packages for more control, isolation, performance and automation."
  }
];

export const consolePricePlans: ConsolePricePlan[] = [
  {
    id: "business-starter-kit",
    name: "Business Starter Kit",
    category: "promos",
    badge: "Free",
    eyebrow: "Launch bundle",
    description: "A starter path for new businesses that need domain guidance, hosting direction, email setup and online launch support.",
    pricing: { kind: "fixed", price: 0, suffix: "starter review" },
    ctaLabel: "Start free",
    product: "Promo",
    adapter: "CustomProviderAdapter",
    providerPackage: "manual_business_starter_review",
    welcomeTemplate: "Business Starter Review Email",
    automationEvent: "Create internal onboarding task",
    features: [
      "Domain name guidance",
      "Shared hosting recommendation",
      "Business email setup direction",
      "SSL setup guidance",
      "Basic website launch checklist",
      "Support before going live"
    ]
  },
  {
    id: "free-migration-review",
    name: "Migration Review",
    category: "promos",
    badge: "Free",
    eyebrow: "Website move",
    description: "Review the current hosting setup and guide the migration path before moving to Octalve Cloud.",
    pricing: { kind: "fixed", price: 0, suffix: "review" },
    ctaLabel: "Request review",
    product: "Migration",
    adapter: "CustomProviderAdapter",
    providerPackage: "manual_migration_review",
    welcomeTemplate: "Migration Review Email",
    automationEvent: "Create migration review ticket",
    features: [
      "Website hosting review",
      "Domain and DNS check",
      "Email migration direction",
      "SSL and backup review",
      "Recommended migration plan",
      "Guided next step"
    ]
  },

  {
    id: "domain-com",
    name: ".com Domain",
    category: "domains",
    eyebrow: "Global domain",
    description: "Best for businesses, startups, personal brands, product websites and international visibility.",
    pricing: { kind: "fixed", price: 15000, suffix: "/year" },
    ctaLabel: "Register .com",
    product: "Domain Registration",
    adapter: "DomainRegistrarAdapter",
    providerPackage: "tld_com_registration",
    welcomeTemplate: "Domain Registration Email",
    automationEvent: "Register domain after paid invoice",
    features: [
      "Global brand-friendly domain",
      "DNS management support",
      "Works with hosting and email",
      "Good for company websites",
      "Easy upgrade into hosting",
      "Guided setup available"
    ]
  },
  {
    id: "domain-ng",
    name: ".ng Domain",
    category: "domains",
    eyebrow: "Premium local",
    description: "Short Nigerian domain extension for businesses that want a clean, local and memorable name.",
    pricing: { kind: "fixed", price: 16500, suffix: "/year" },
    ctaLabel: "Register .ng",
    product: "Domain Registration",
    adapter: "DomainRegistrarAdapter",
    providerPackage: "tld_ng_registration",
    welcomeTemplate: "Domain Registration Email",
    automationEvent: "Register domain after paid invoice",
    features: [
      "Short Nigerian extension",
      "Good for brand recall",
      "Local business positioning",
      "DNS support",
      "Hosting-ready setup",
      "Email-ready setup"
    ]
  },

  {
    id: "private-email",
    name: "Private Email",
    category: "email",
    eyebrow: "Professional email",
    description: "Create a professional inbox with your domain for better brand trust and communication.",
    pricing: { kind: "cycle", baseMonthlyPrice: 2500, regularMonthlyPrice: 3500 },
    ctaLabel: "Choose email",
    product: "Business Email",
    adapter: "EmailProviderAdapter",
    providerPackage: "private_email_single_mailbox",
    welcomeTemplate: "Email Service Welcome Email",
    automationEvent: "Create mailbox service after payment",
    features: [
      "Professional domain email",
      "Mailbox setup support",
      "Works with your domain",
      "Better business trust",
      "Spam protection guidance",
      "Webmail access",
      "Upgrade-ready for teams"
    ]
  },
  {
    id: "business-email",
    name: "Business Email",
    category: "email",
    popular: true,
    eyebrow: "For growing teams",
    description: "A better email setup for companies that need multiple professional addresses and stronger structure.",
    pricing: { kind: "cycle", baseMonthlyPrice: 6000, regularMonthlyPrice: 8500 },
    ctaLabel: "Choose email",
    product: "Business Email",
    adapter: "EmailProviderAdapter",
    providerPackage: "business_email_team",
    welcomeTemplate: "Email Service Welcome Email",
    automationEvent: "Create team email service after payment",
    features: [
      "Multiple business mailboxes",
      "Domain-based email",
      "Support for teams",
      "Email forwarding guidance",
      "Autoresponder guidance",
      "Spam protection",
      "Professional communication setup",
      "Support included"
    ]
  },

  {
    id: "wordpress-launch",
    name: "WordPress Launch",
    category: "wordpress",
    eyebrow: "Starter WordPress",
    description: "A WordPress-ready plan for simple business websites, blogs and landing pages.",
    pricing: { kind: "cycle", baseMonthlyPrice: 6500, regularMonthlyPrice: 9000 },
    ctaLabel: "Choose WordPress",
    product: "WordPress Hosting",
    adapter: "DirectAdminAdapter",
    providerPackage: "wordpress_launch_1_site",
    welcomeTemplate: "Hosting Welcome Email",
    automationEvent: "Provision hosting account after paid invoice",
    features: [
      "WordPress-ready hosting",
      "Free SSL support",
      "1 website",
      "Business email support",
      "Basic setup guidance",
      "Good for blogs and company pages",
      "Upgrade-ready hosting"
    ]
  },
  {
    id: "wordpress-business",
    name: "WordPress Business",
    category: "wordpress",
    popular: true,
    eyebrow: "Business website",
    description: "For growing business websites that need stronger hosting resources and guided support.",
    pricing: { kind: "cycle", baseMonthlyPrice: 12000, regularMonthlyPrice: 16000 },
    ctaLabel: "Choose WordPress",
    product: "WordPress Hosting",
    adapter: "DirectAdminAdapter",
    providerPackage: "wordpress_business_3_sites",
    welcomeTemplate: "Hosting Welcome Email",
    automationEvent: "Provision hosting account after paid invoice",
    features: [
      "WordPress-ready hosting",
      "Up to 3 websites",
      "Free SSL support",
      "Business email support",
      "Migration support",
      "DNS guidance",
      "Better performance path",
      "Support included"
    ]
  },

  {
    id: "launch-shared-hosting",
    name: "Launch",
    category: "hosting",
    eyebrow: "Shared Hosting",
    description: "For simple portfolio, landing page and small business websites that need a clean online start.",
    pricing: { kind: "cycle", baseMonthlyPrice: 4500, regularMonthlyPrice: 6500 },
    ctaLabel: "Choose plan",
    product: "Web Hosting",
    adapter: "DirectAdminAdapter",
    providerPackage: "directadmin_launch_1gb",
    welcomeTemplate: "Hosting Welcome Email",
    automationEvent: "Provision hosting account after paid invoice",
    features: [
      "1 Website",
      "1 GB SSD Storage",
      "10 GB Bandwidth",
      "2 Email Accounts",
      "2 Subdomains",
      "1 MySQL Database",
      "1 FTP Account",
      "Free SSL Certificate",
      "PHP Access",
      "CGI Access",
      "DNS Control",
      "Cron Jobs",
      "Spam Protection",
      "Login Keys",
      "System Info Access",
      "Suspend at Limit Protection"
    ]
  },
  {
    id: "starter-shared-hosting",
    name: "Starter",
    category: "hosting",
    popular: true,
    eyebrow: "Shared Hosting",
    description: "Best for business websites, growing brands and multi-page projects that need more room.",
    pricing: { kind: "cycle", baseMonthlyPrice: 9500, regularMonthlyPrice: 12000 },
    ctaLabel: "Choose plan",
    product: "Web Hosting",
    adapter: "DirectAdminAdapter",
    providerPackage: "directadmin_starter_10gb",
    welcomeTemplate: "Hosting Welcome Email",
    automationEvent: "Provision hosting account after paid invoice",
    features: [
      "Up to 3 Websites",
      "10 GB SSD Storage",
      "Unlimited Bandwidth",
      "Unlimited Email Accounts",
      "Unlimited Subdomains",
      "10 MySQL Databases",
      "3 FTP Accounts",
      "3 Domain Pointers",
      "Free SSL Certificate",
      "PHP Access",
      "CGI Access",
      "DNS Control",
      "Cron Jobs",
      "Spam Protection",
      "Unlimited Autoresponders",
      "Unlimited Email Forwarders",
      "Priority Setup Guidance"
    ]
  },
  {
    id: "pro-shared-hosting",
    name: "Pro",
    category: "hosting",
    eyebrow: "Shared Hosting",
    description: "For stronger business websites that need more storage, more domains and more database room.",
    pricing: { kind: "cycle", baseMonthlyPrice: 18000, regularMonthlyPrice: 25000 },
    ctaLabel: "Choose plan",
    product: "Web Hosting",
    adapter: "DirectAdminAdapter",
    providerPackage: "directadmin_pro_50gb",
    welcomeTemplate: "Hosting Welcome Email",
    automationEvent: "Provision hosting account after paid invoice",
    features: [
      "Up to 10 Websites",
      "50 GB SSD Storage",
      "Unlimited Bandwidth",
      "Unlimited Email Accounts",
      "25 MySQL Databases",
      "10 FTP Accounts",
      "10 Domain Pointers",
      "Free SSL Certificate",
      "Cron Jobs",
      "DNS Control",
      "Spam Protection",
      "Priority setup guidance",
      "Business-ready hosting"
    ]
  },
  {
    id: "unlimited-shared-hosting",
    name: "Unlimited",
    category: "hosting",
    eyebrow: "Shared Hosting",
    description: "For businesses that need fewer limits, stronger flexibility and more hosting capacity.",
    pricing: { kind: "cycle", baseMonthlyPrice: 35000, regularMonthlyPrice: 45000 },
    ctaLabel: "Choose plan",
    product: "Web Hosting",
    adapter: "DirectAdminAdapter",
    providerPackage: "directadmin_unlimited",
    welcomeTemplate: "Hosting Welcome Email",
    automationEvent: "Provision hosting account after paid invoice",
    features: [
      "Unlimited Websites",
      "Unlimited Disk Space",
      "Unlimited Bandwidth",
      "Unlimited Email Accounts",
      "Unlimited MySQL Databases",
      "Unlimited FTP Accounts",
      "Free SSL Certificate",
      "SSH Access",
      "DNS Control",
      "Cron Jobs",
      "Spam Protection",
      "Best for larger hosting needs"
    ]
  },

  {
    id: "askssl-starter",
    name: "AskSSL Starter",
    category: "security",
    eyebrow: "Basic SSL",
    popular: true,
    description: "An entry-level SSL certificate for websites that need quick HTTPS protection, browser trust and a clean security start.",
    pricing: { kind: "fixed", price: 7500, suffix: "/year" },
    ctaLabel: "Choose certificate",
    finePrint: "Best for simple websites, landing pages and starter business platforms.",
    product: "SSL Certificates",
    adapter: "SslProviderAdapter",
    providerPackage: "askssl_starter_dv",
    welcomeTemplate: "SSL Activation Email",
    automationEvent: "Issue SSL certificate after paid invoice",
    features: [
      "Domain Validated Certificate",
      "Warranty up to $10,000",
      "Secures 1 domain",
      "Issuance in about 3 minutes",
      "HTTPS and browser trust",
      "Guided SSL installation support"
    ]
  },
  {
    id: "askssl-wildcard",
    name: "AskSSL Wildcard SSL",
    category: "security",
    eyebrow: "Wildcard SSL",
    description: "Protect your main domain and subdomains with one wildcard certificate built for broader website coverage.",
    pricing: { kind: "fixed", price: 84000, suffix: "/year" },
    ctaLabel: "Choose wildcard",
    product: "SSL Certificates",
    adapter: "SslProviderAdapter",
    providerPackage: "askssl_wildcard",
    welcomeTemplate: "SSL Activation Email",
    automationEvent: "Issue SSL certificate after paid invoice",
    features: [
      "Domain Validated Warranty up to $10,000",
      "Wildcard SSL for subdomains",
      "Covers main domain and subdomains",
      "Issuance in 3–5 days",
      "Better flexibility for growing platforms",
      "Guided installation support"
    ]
  },

  {
    id: "vps-1",
    name: "VPS 1",
    category: "vps",
    eyebrow: "Cloud Server",
    description: "Entry VPS power for small applications, business websites and lightweight portals.",
    pricing: {
      kind: "cycle",
      baseMonthlyPrice: 10900,
      regularMonthlyPrice: 28900,
      billingAdjustments: { "1mo": 0, "12mo": 45, "24mo": 62, "48mo": 65 }
    },
    ctaLabel: "Choose plan",
    product: "VPS Hosting",
    adapter: "ProxmoxAdapter",
    providerPackage: "proxmox_vps_1_4gb",
    welcomeTemplate: "VPS Welcome Email",
    automationEvent: "Provision VPS after paid invoice",
    features: [
      "1 vCPU core",
      "4 GB RAM",
      "50 GB NVMe disk space",
      "4 TB bandwidth",
      "Dedicated VPS environment",
      "Root/server-level control",
      "Free SSL support",
      "Migration assistance",
      "Weekly backup-ready setup",
      "Firewall setup guidance",
      "Suitable for small apps and websites"
    ]
  },
  {
    id: "vps-2",
    name: "VPS 2",
    category: "vps",
    eyebrow: "Cloud Server",
    popular: true,
    description: "Balanced VPS performance for growing websites, portals, automations, dashboards and medium-scale applications.",
    pricing: {
      kind: "cycle",
      baseMonthlyPrice: 13900,
      regularMonthlyPrice: 35900,
      billingAdjustments: { "1mo": 0, "12mo": 42, "24mo": 61, "48mo": 64 }
    },
    ctaLabel: "Choose plan",
    product: "VPS Hosting",
    adapter: "ProxmoxAdapter",
    providerPackage: "proxmox_vps_2_8gb",
    welcomeTemplate: "VPS Welcome Email",
    automationEvent: "Provision VPS after paid invoice",
    features: [
      "2 vCPU cores",
      "8 GB RAM",
      "100 GB NVMe disk space",
      "8 TB bandwidth",
      "Dedicated VPS environment",
      "Better performance isolation",
      "Free SSL support",
      "Migration assistance",
      "Weekly backup-ready setup",
      "Firewall setup guidance",
      "Suitable for portals and automations",
      "Recommended for growing businesses"
    ]
  },
  {
    id: "vps-4",
    name: "VPS 4",
    category: "vps",
    eyebrow: "Cloud Server",
    description: "Higher-performance VPS capacity for serious business systems, ecommerce workloads, SaaS dashboards and heavier applications.",
    pricing: {
      kind: "cycle",
      baseMonthlyPrice: 18900,
      regularMonthlyPrice: 59900,
      billingAdjustments: { "1mo": 0, "12mo": 55, "24mo": 68, "48mo": 70 }
    },
    ctaLabel: "Choose plan",
    product: "VPS Hosting",
    adapter: "ProxmoxAdapter",
    providerPackage: "proxmox_vps_4_16gb",
    welcomeTemplate: "VPS Welcome Email",
    automationEvent: "Provision VPS after paid invoice",
    features: [
      "4 vCPU cores",
      "16 GB RAM",
      "200 GB NVMe disk space",
      "16 TB bandwidth",
      "Dedicated VPS environment",
      "High-performance resource control",
      "Free SSL support",
      "Migration assistance",
      "Weekly backup-ready setup",
      "Firewall setup guidance",
      "Suitable for SaaS and ecommerce",
      "Built for heavier workloads"
    ]
  }
];

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}

function roundPrice(value: number) {
  return Math.round(value / 100) * 100;
}

export function getConsoleBillingCycle(key: ConsoleBillingCycleKey) {
  return consoleBillingCycles.find((cycle) => cycle.key === key) ?? consoleBillingCycles[0];
}

export function calculateConsolePlanPricing(
  plan: ConsolePricePlan,
  billingCycleKey: ConsoleBillingCycleKey
): PlanPricingDisplay {
  if (plan.pricing.kind === "fixed") {
    const discountPercent =
      plan.pricing.regularPrice && plan.pricing.regularPrice > plan.pricing.price
        ? Math.round(((plan.pricing.regularPrice - plan.pricing.price) / plan.pricing.regularPrice) * 100)
        : undefined;

    return {
      priceLabel: plan.pricing.price === 0 ? "₦0" : formatNaira(plan.pricing.price),
      suffix: plan.pricing.suffix,
      regularPriceLabel: plan.pricing.regularPrice ? formatNaira(plan.pricing.regularPrice) : undefined,
      discountPercent
    };
  }

  const cycle = getConsoleBillingCycle(billingCycleKey);
  const discountPercent = plan.pricing.billingAdjustments?.[cycle.key] ?? cycle.discountPercent;
  const regularMonthly = plan.pricing.regularMonthlyPrice ?? plan.pricing.baseMonthlyPrice;
  const regularTotal = regularMonthly * cycle.months;

  const total = roundPrice(
    plan.pricing.baseMonthlyPrice * cycle.months * ((100 - discountPercent) / 100)
  );

  const monthlyEquivalent = Math.max(0, roundPrice(total / cycle.months));
  const regularMonthlyEquivalent = roundPrice(regularTotal / cycle.months);

  return {
    priceLabel: formatNaira(monthlyEquivalent),
    suffix: "/mo",
    regularPriceLabel:
      regularMonthlyEquivalent > monthlyEquivalent ? formatNaira(regularMonthlyEquivalent) : undefined,
    totalLabel:
      cycle.months === 1
        ? `Pay ${formatNaira(total)} today.`
        : `Get ${cycle.label} for ${formatNaira(total)}.`,
    renewsLabel: `Renews at ${formatNaira(regularMonthly)}/mo.`,
    discountPercent: discountPercent > 0 ? discountPercent : undefined
  };
}

export function buildConsolePlanCtaHref(plan: ConsolePricePlan, billingCycleKey: ConsoleBillingCycleKey) {
  if (plan.pricing.kind !== "cycle") {
    return `/client/order/checkout?plan=${encodeURIComponent(plan.id)}`;
  }

  return `/client/order/checkout?plan=${encodeURIComponent(plan.id)}&cycle=${encodeURIComponent(
    billingCycleKey
  )}`;
}

export const extraConsolePricePlans: ConsolePricePlan[] = [
  {
    id: "rapidssl-certificate",
    name: "RapidSSL Certificate",
    category: "security",
    eyebrow: "Fast SSL",
    description:
      "A fast domain-validated SSL option for businesses that need trusted encryption and quick security setup.",
    pricing: {
      kind: "fixed",
      price: 10240,
      suffix: "/year"
    },
    ctaLabel: "Choose certificate",
    finePrint: "Suitable for company websites, landing pages and online business presence.",
    product: "SSL Certificates",
    adapter: "SslProviderAdapter",
    providerPackage: "rapidssl_dv_certificate",
    welcomeTemplate: "SSL Activation Email",
    automationEvent: "Issue SSL certificate after paid invoice",
    features: [
      "Domain Validated SSL",
      "Secures 1 domain",
      "Issuance in about 3 minutes",
      "Strong browser compatibility",
      "HTTPS encryption and trust",
      "Guided setup support"
    ]
  },
  {
    id: "thawte-server-ssl",
    name: "Thawte Server SSL",
    category: "security",
    eyebrow: "Business SSL",
    description:
      "A stronger business SSL option for websites that need dependable encryption, trust and broader protection support.",
    pricing: {
      kind: "fixed",
      price: 69428,
      suffix: "/year"
    },
    ctaLabel: "Choose certificate",
    finePrint: "Good for professional websites, business platforms and higher-trust online presence.",
    product: "SSL Certificates",
    adapter: "SslProviderAdapter",
    providerPackage: "thawte_server_ssl",
    welcomeTemplate: "SSL Activation Email",
    automationEvent: "Issue SSL certificate after paid invoice",
    features: [
      "Domain Validated SSL",
      "Secures 1 primary domain",
      "Secure subdomain support",
      "Business-grade SSL trust",
      "HTTPS encryption and browser trust",
      "Guided setup support"
    ]
  },
  {
    id: "vps-3",
    name: "VPS 3",
    category: "vps",
    eyebrow: "Cloud Server",
    description:
      "A stronger VPS plan for business portals, heavier websites, internal systems and growing app workloads.",
    pricing: {
      kind: "cycle",
      baseMonthlyPrice: 15900,
      regularMonthlyPrice: 45900,
      billingAdjustments: {
        "1mo": 0,
        "12mo": 48,
        "24mo": 63,
        "48mo": 66
      }
    },
    ctaLabel: "Choose plan",
    product: "VPS Hosting",
    adapter: "ProxmoxAdapter",
    providerPackage: "proxmox_vps_3_12gb",
    welcomeTemplate: "VPS Welcome Email",
    automationEvent: "Provision VPS after paid invoice",
    features: [
      "3 vCPU cores",
      "12 GB RAM",
      "150 GB NVMe disk space",
      "12 TB bandwidth",
      "Dedicated VPS environment",
      "Root/server-level control",
      "Free SSL support",
      "Migration assistance",
      "Weekly backup-ready setup",
      "Firewall setup guidance",
      "Suitable for business portals"
    ]
  },
  {
    id: "vps-8",
    name: "VPS 8",
    category: "vps",
    eyebrow: "Cloud Server",
    description:
      "Advanced VPS capacity for larger systems, high-traffic platforms, multi-project hosting and infrastructure-heavy deployments.",
    pricing: {
      kind: "cycle",
      baseMonthlyPrice: 37900,
      regularMonthlyPrice: 105900,
      billingAdjustments: {
        "1mo": 0,
        "12mo": 52,
        "24mo": 64,
        "48mo": 67
      }
    },
    ctaLabel: "Choose plan",
    product: "VPS Hosting",
    adapter: "ProxmoxAdapter",
    providerPackage: "proxmox_vps_8_32gb",
    welcomeTemplate: "VPS Welcome Email",
    automationEvent: "Provision VPS after paid invoice",
    features: [
      "8 vCPU cores",
      "32 GB RAM",
      "400 GB NVMe disk space",
      "32 TB bandwidth",
      "Dedicated VPS environment",
      "Advanced performance capacity",
      "Free SSL support",
      "Migration assistance",
      "Weekly backup-ready setup",
      "Firewall setup guidance",
      "Suitable for larger platforms",
      "Built for high-traffic systems"
    ]
  }
];

export const consoleCatalogPlans: ConsolePricePlan[] = [
  ...consolePricePlans,
  ...extraConsolePricePlans
];

export type ConsoleCoupon = {
  code: string;
  label: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo: "all" | ConsolePackageCategoryKey[];
  active: boolean;
};

export const consoleCoupons: ConsoleCoupon[] = [
  {
    code: "OCTALVE10",
    label: "10% Octalve launch discount",
    type: "percent",
    value: 10,
    appliesTo: "all",
    active: true
  },
  {
    code: "HOSTING500",
    label: "₦500 hosting discount",
    type: "fixed",
    value: 500,
    appliesTo: ["hosting", "wordpress"],
    active: true
  },
  {
    code: "VPS5",
    label: "5% VPS discount",
    type: "percent",
    value: 5,
    appliesTo: ["vps"],
    active: true
  }
];

export function getConsoleCatalogPlan(planId?: string | null) {
  return (
    consoleCatalogPlans.find((plan) => plan.id === planId) ??
    consoleCatalogPlans.find((plan) => plan.id === "starter-shared-hosting") ??
    consoleCatalogPlans[0]
  );
}

export function calculateConsolePlanTotal(
  plan: ConsolePricePlan,
  billingCycleKey: ConsoleBillingCycleKey
) {
  if (plan.pricing.kind === "fixed") {
    return Math.max(0, plan.pricing.price);
  }

  const cycle = getConsoleBillingCycle(billingCycleKey);
  const discountPercent =
    plan.pricing.billingAdjustments?.[cycle.key] ?? cycle.discountPercent;

  return roundPrice(
    plan.pricing.baseMonthlyPrice *
      cycle.months *
      ((100 - discountPercent) / 100)
  );
}

export function applyConsoleCoupon(
  code: string,
  subtotal: number,
  category: ConsolePackageCategoryKey
) {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return {
      valid: false,
      discount: 0,
      message: "Enter a coupon code."
    };
  }

  const coupon = consoleCoupons.find(
    (item) => item.code === normalizedCode && item.active
  );

  if (!coupon) {
    return {
      valid: false,
      discount: 0,
      message: "Coupon code was not found or is inactive."
    };
  }

  const applies =
    coupon.appliesTo === "all" || coupon.appliesTo.includes(category);

  if (!applies) {
    return {
      valid: false,
      discount: 0,
      message: "This coupon does not apply to the selected package."
    };
  }

  const discount =
    coupon.type === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : coupon.value;

  return {
    valid: true,
    coupon,
    discount: Math.min(discount, subtotal),
    message: coupon.label
  };
}
