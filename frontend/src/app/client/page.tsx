// src/app/client/page.tsx
"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileText,
  Globe,
  LifeBuoy,
  Plus,
  Receipt,
  Server,
  ShoppingCart,
  Ticket,
  Wallet,
} from "lucide-react";
import {
  ClientPromoCarousel,
  type PromoSlide,
} from "@/components/modules/client/ClientPromoCarousel";
import { customers, invoices, services, tickets } from "@/lib/platform-data";

function cleanMoney(value: string) {
  return value.replace(/â‚¦/g, "₦");
}

function getGreetingByTime() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Replace this with your real auth/session first name once auth is connected.
 * For now it is safe as a UI-ready fallback.
 */
function getClientFirstName() {
  const fallbackName = "Alex";
  return fallbackName.split(" ")[0];
}

function getServiceCategory(product: string) {
  const normalized = product.toLowerCase();

  if (normalized.includes("vps")) return "VPS Hosting";
  if (normalized.includes("domain")) return "Domain Registration";
  if (normalized.includes("ssl")) return "SSL Certificate";
  if (normalized.includes("email")) return "Business Email";
  return "Web Hosting";
}

function getServiceIcon(product: string) {
  const normalized = product.toLowerCase();

  if (normalized.includes("vps")) return <Server size={21} />;
  if (normalized.includes("domain")) return <Globe size={21} />;
  if (normalized.includes("ssl")) return <FileText size={21} />;
  return <Globe size={21} />;
}

function getServicePerformance(product: string) {
  const normalized = product.toLowerCase();

  if (normalized.includes("vps")) return 94;
  if (normalized.includes("domain")) return 100;
  return 98;
}

function getInvoiceActionHref(invoiceId: string, status: string) {
  if (status === "Paid") return `/client/invoices/${invoiceId}`;
  return `/client/order/checkout?invoice=${invoiceId}`;
}

const promoSlides: PromoSlide[] = [
  {
    id: "promo-1",
    eyebrow: "Launch faster",
    title: "Move your website online with hosting, SSL and setup support.",
    description:
      "Browse shared hosting, domains and SSL options from one clean ordering experience.",
    ctaLabel: "Buy services",
    href: "/client/order",
    image: "/images/dashboard-promos/promo-1.jpg",
  },
  {
    id: "promo-2",
    eyebrow: "Need help?",
    title: "Support, migration and guidance are always within reach.",
    description:
      "Open a ticket and let the team help with DNS, migration, billing or account setup.",
    ctaLabel: "Open support",
    href: "/client/support/new",
    image: "/images/dashboard-promos/promo-2.jpg",
  },
  {
    id: "promo-3",
    eyebrow: "Stay covered",
    title:
      "Protect your brand with domain renewals, backups and security add-ons.",
    description:
      "Keep your account ready with domain management, billing visibility and helpful reminders.",
    ctaLabel: "View invoices",
    href: "/client/invoices",
    image: "/images/dashboard-promos/promo-3.jpg",
  },
];

export default function Page() {
  const greeting = getGreetingByTime();
  const firstName = getClientFirstName();

  const activeServicesCount = services.filter(
    (service) => service.status === "Active",
  ).length;
  const unpaidInvoicesCount = invoices.filter(
    (invoice) => invoice.status !== "Paid",
  ).length;
  const walletBalance = cleanMoney(
    customers.find((item) => item.balance)?.balance ?? "₦3,500",
  );
  const openTicketsCount = tickets.filter(
    (ticket) => !ticket.status.toLowerCase().includes("closed"),
  ).length;

  const servicePreview = services.slice(0, 3);
  const recentBilling = invoices.slice(0, 3);

  return (
    <main className="page-container dashboard-home-page">
      <section className="dashboard-hero-banner">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-eyebrow">{greeting},</span>
          <h1 className="dashboard-hero-title">Welcome {firstName} 👋</h1>
          <p className="dashboard-hero-description">
            Here&apos;s what&apos;s happening with your account today.
          </p>

          <div className="dashboard-hero-actions">
            <Link href="/client/order" className="dashboard-hero-action">
              <ShoppingCart size={18} />
              Buy Service
            </Link>

            <Link
              href="/client/support/new"
              className="dashboard-hero-action secondary"
            >
              <Plus size={18} />
              Open Ticket
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-overview-grid">
        <article className="dashboard-overview-card">
          <div>
            <span>Active Services</span>
            <strong>{activeServicesCount}</strong>
          </div>
          <div className="dashboard-overview-icon">
            <Server size={22} />
          </div>
        </article>

        <article className="dashboard-overview-card">
          <div>
            <span>Unpaid Invoices</span>
            <strong>{unpaidInvoicesCount}</strong>
          </div>
          <div className="dashboard-overview-icon">
            <Receipt size={22} />
          </div>
        </article>

        <article className="dashboard-overview-card">
          <div>
            <span>Wallet Balance</span>
            <strong>{walletBalance}</strong>
          </div>
          <div className="dashboard-overview-icon">
            <Wallet size={22} />
          </div>
        </article>

        <article className="dashboard-overview-card">
          <div>
            <span>Open Tickets</span>
            <strong>{openTicketsCount}</strong>
          </div>
          <div className="dashboard-overview-icon">
            <Ticket size={22} />
          </div>
        </article>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-section-head">
          <div>
            <h2>Your Services</h2>
            <p>Manage your most recent active products from one place.</p>
          </div>

          <Link href="/client/services" className="dashboard-section-link">
            View all
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="dashboard-service-list">
          {servicePreview.map((service) => {
            const performance = getServicePerformance(service.product);
            const angle = performance * 3.6;

            return (
              <article key={service.id} className="dashboard-service-row">
                <div className="dashboard-service-main">
                  <span className="dashboard-service-icon">
                    {getServiceIcon(service.product)}
                  </span>

                  <div className="dashboard-service-copy">
                    <strong>{service.label}</strong>
                    <span>
                      {getServiceCategory(service.product)} · {service.id}
                    </span>
                  </div>
                </div>

                <div className="dashboard-service-meta">
                  <strong>{service.package}</strong>
                  <span>{service.term.replace(/â‚¦/g, "₦")}</span>
                </div>

                <div className="dashboard-service-meta">
                  <strong>{service.renews}</strong>
                  <span>Auto-renew ready</span>
                </div>

                <div className="dashboard-service-status">
                  <span
                    className={
                      service.status === "Active"
                        ? "premium-status active"
                        : "premium-status pending"
                    }
                  >
                    <i />
                    {service.status}
                  </span>
                </div>

                <div className="dashboard-service-performance">
                  <div
                    className="dashboard-progress-ring"
                    style={{
                      background: `conic-gradient(#30b74a ${angle}deg, #dfe7f3 0deg)`,
                    }}
                  >
                    <div>
                      <strong>{performance}</strong>
                    </div>
                  </div>
                </div>

                <div className="dashboard-service-actions">
                  <Link
                    href={`/client/services/${service.id}`}
                    className="dashboard-manage-btn"
                  >
                    Manage
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-section-head">
          <div>
            <h2>Recent Billing</h2>
            <p>
              Track your most recent invoices, payment state and next action.
            </p>
          </div>

          <Link href="/client/invoices" className="dashboard-section-link">
            View all
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="dashboard-billing-list">
          {recentBilling.map((invoice) => (
            <article key={invoice.id} className="dashboard-billing-row">
              <div className="dashboard-billing-main">
                <span className="dashboard-billing-icon">
                  <CreditCard size={20} />
                </span>

                <div className="dashboard-billing-copy">
                  <strong>{invoice.id}</strong>
                  <span>Issued {invoice.date}</span>
                </div>
              </div>

              <div className="dashboard-billing-amount">
                <strong>{cleanMoney(invoice.total)}</strong>
                <span>Due {invoice.dueDate}</span>
              </div>

              <div className="dashboard-billing-status">
                <span
                  className={
                    invoice.status === "Paid"
                      ? "premium-status active"
                      : "premium-status pending"
                  }
                >
                  <i />
                  {invoice.status}
                </span>
              </div>

              <div className="dashboard-billing-action">
                <Link href={getInvoiceActionHref(invoice.id, invoice.status)}>
                  {invoice.status === "Paid" ? "View Invoice" : "Pay Now"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-section-head">
          <div>
            <h2>Offers & Promotions</h2>
            <p>
              Quick access to featured offers, support guidance and useful
              account actions.
            </p>
          </div>
        </div>

        <ClientPromoCarousel slides={promoSlides} />
      </section>
    </main>
  );
}
