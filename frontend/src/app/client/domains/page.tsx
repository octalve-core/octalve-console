"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CreditCard,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PremiumTable, type PremiumTableColumn } from "@/components/ui/PremiumTable";
import { domains } from "@/lib/platform-data";

type DomainRow = (typeof domains)[number] & {
  type: string;
  privacy: string;
  health: string;
};

const domainRows: DomainRow[] = domains.map((domain) => ({
  ...domain,
  type: domain.domain.includes(".cloud") ? "Managed domain" : "Registered domain",
  privacy: "Protected",
  health: "Secure",
}));

const columns: PremiumTableColumn<DomainRow>[] = [
  {
    key: "domain",
    header: "Domain",
    render: (row) => (
      <div className="premium-main-cell">
        <span className="premium-cell-icon">
          <Globe2 size={22} />
        </span>
        <div>
          <Link className="premium-primary-text" href={`/client/domains/${row.id}`}>
            {row.domain}
          </Link>
          <span className="premium-secondary-text">{row.type}</span>
        </div>
      </div>
    ),
  },
  {
    key: "renewal",
    header: "Renewal",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.renewal}</span>
        <span className="premium-secondary-text">
          Auto-renew {row.autoRenew === "On" ? "enabled" : "disabled"}
        </span>
      </div>
    ),
  },
  {
    key: "privacy",
    header: "Privacy",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.privacy}</span>
        <span className="premium-secondary-text">Contact details protected</span>
      </div>
    ),
  },
  {
    key: "health",
    header: "DNS / Health",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.health}</span>
        <span className="premium-secondary-text">DNS ready for hosting, email and SSL</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className={row.status === "Active" ? "premium-status active" : "premium-status pending"}>
        <i />
        {row.status}
      </span>
    ),
  },
];

export default function Page() {
  const [domainSearch, setDomainSearch] = useState("");

  const activeCount = domains.filter((domain) => domain.status === "Active").length;
  const autoRenewCount = domains.filter((domain) => domain.autoRenew === "On").length;

  const registerHref = useMemo(() => {
    const query = domainSearch.trim();

    if (!query) return "/client/order/checkout?category=domains";

    return `/client/order/checkout?category=domains&domain=${encodeURIComponent(query)}&domainMode=register`;
  }, [domainSearch]);

  return (
    <main className="page-container">
      <PageHeader
        title="Domains"
        description="Search, register, renew and manage DNS for domains connected to your Octalve Cloud services."
      />

      <section className="domain-command-panel">
        <div className="domain-command-copy">
          <span className="domain-command-icon">
            <Globe2 size={22} />
          </span>
          <div>
            <h2>Find or connect a domain</h2>
            <p>
              Register a new domain, transfer an existing one, or connect your current domain to hosting, email and SSL.
            </p>
          </div>
        </div>

        <div className="domain-command-search">
          <Search size={18} />
          <input
            value={domainSearch}
            onChange={(event) => setDomainSearch(event.target.value)}
            placeholder="Search example.com"
          />
          <Link href={registerHref}>Search</Link>
        </div>
      </section>

      <section className="domain-stats-grid">
        <div className="domain-stat-card">
          <span className="premium-cell-icon">
            <Globe2 size={20} />
          </span>
          <div>
            <strong>{domains.length}</strong>
            <p>Total domains</p>
          </div>
        </div>

        <div className="domain-stat-card">
          <span className="premium-cell-icon green">
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>{activeCount}</strong>
            <p>Active domains</p>
          </div>
        </div>

        <div className="domain-stat-card">
          <span className="premium-cell-icon orange">
            <RefreshCcw size={20} />
          </span>
          <div>
            <strong>{autoRenewCount}</strong>
            <p>Auto-renew enabled</p>
          </div>
        </div>

        <div className="domain-stat-card">
          <span className="premium-cell-icon purple">
            <LockKeyhole size={20} />
          </span>
          <div>
            <strong>Ready</strong>
            <p>DNS protection</p>
          </div>
        </div>
      </section>

      <PremiumTable
        title="My Domains"
        description="Manage nameservers, DNS records, renewal status and domain security from one workspace."
        rows={domainRows}
        columns={columns}
        searchPlaceholder="Search domains..."
        searchKeys={["domain", "status", "renewal", "autoRenew"]}
        primaryAction={
          <Link className="client-add-service" href="/client/order/checkout?category=domains">
            <Plus size={18} />
            Add Domain
          </Link>
        }
        rowActions={(row) => [
          {
            label: "Manage domain",
            href: `/client/domains/${row.id}`,
            icon: <Settings2 size={16} />,
          },
          {
            label: "Renew now",
            href: `/client/order/checkout?domain=${row.domain}&action=renew`,
            icon: <RefreshCcw size={16} />,
          },
          {
            label: "View invoices",
            href: "/client/invoices",
            icon: <CreditCard size={16} />,
          },
          {
            label: "Get support",
            href: `/client/support/new?domain=${row.domain}`,
            icon: <LifeBuoy size={16} />,
          },
        ]}
      />

      <section className="domain-upsell-grid">
        <Link href="/client/order/checkout?category=hosting" className="domain-upsell-card">
          <span className="premium-cell-icon">
            <Globe2 size={20} />
          </span>
          <div>
            <h3>Add hosting</h3>
            <p>Connect your domain to a website hosting package.</p>
          </div>
        </Link>

        <Link href="/client/order/checkout?category=email" className="domain-upsell-card">
          <span className="premium-cell-icon orange">
            <LockKeyhole size={20} />
          </span>
          <div>
            <h3>Add business email</h3>
            <p>Create professional email addresses for your domain.</p>
          </div>
        </Link>

        <Link href="/client/order/checkout?category=security" className="domain-upsell-card">
          <span className="premium-cell-icon green">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h3>Add SSL/security</h3>
            <p>Protect your domain with SSL and security add-ons.</p>
          </div>
        </Link>
      </section>
    </main>
  );
}
