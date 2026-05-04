"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  ExternalLink,
  Globe2,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { services } from "@/lib/platform-data";

type ServiceFilter = "all" | "hosting" | "vps" | "domains" | "email" | "ssl";

const filters: { key: ServiceFilter; label: string }[] = [
  { key: "all", label: "All services" },
  { key: "hosting", label: "Websites" },
  { key: "vps", label: "VPS" },
  { key: "domains", label: "Domains" },
  { key: "email", label: "Email" },
  { key: "ssl", label: "SSL" },
];

function getServiceType(service: (typeof services)[number]): ServiceFilter {
  const product = service.product.toLowerCase();

  if (product.includes("vps")) return "vps";
  if (product.includes("domain")) return "domains";
  if (product.includes("email")) return "email";
  if (product.includes("ssl")) return "ssl";

  return "hosting";
}

function getServiceIcon(service: (typeof services)[number]) {
  const type = getServiceType(service);

  if (type === "vps") return Server;
  if (type === "domains") return Globe2;
  if (type === "email") return Mail;
  if (type === "ssl") return ShieldCheck;

  return Globe2;
}

function getServiceTone(service: (typeof services)[number]) {
  const type = getServiceType(service);

  if (type === "vps") return "purple";
  if (type === "domains") return "blue";
  if (type === "email") return "orange";
  if (type === "ssl") return "green";

  return service.status === "Pending" ? "orange" : "blue";
}

function getPerformanceScore(service: (typeof services)[number]) {
  const type = getServiceType(service);

  if (type === "vps") return 94;
  if (type === "domains") return 100;
  if (type === "ssl") return 99;
  if (type === "email") return 96;

  return service.status === "Active" ? 98 : 82;
}

function getStatusClass(status: string) {
  const value = status.toLowerCase();

  if (value.includes("active")) return "service-status active";
  if (value.includes("pending")) return "service-status pending";
  if (value.includes("suspend")) return "service-status suspended";

  return "service-status";
}

export default function Page() {
  const [activeFilter, setActiveFilter] = useState<ServiceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const type = getServiceType(service);
      const searchValue = `${service.id} ${service.package} ${service.product} ${service.label} ${service.status}`.toLowerCase();
      const matchesFilter = activeFilter === "all" || type === activeFilter;
      const matchesSearch = searchValue.includes(searchQuery.trim().toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

  const activeCount = services.filter((service) => service.status === "Active").length;
  const hostingCount = services.filter((service) => getServiceType(service) === "hosting").length;
  const domainCount = services.filter((service) => getServiceType(service) === "domains").length;
  const pendingCount = services.filter((service) => service.status !== "Active").length;

  return (
    <main className="page-container">
      <PageHeader
        title="My Services"
        description="Manage your websites, hosting, VPS, domains, SSL, email and renewals from one clean workspace."
      />

      <section className="client-service-stats">
        <div className="client-service-stat">
          <span className="service-stat-icon blue">
            <Globe2 size={22} />
          </span>
          <div>
            <p>Websites</p>
            <strong>{hostingCount}</strong>
            <small>Managed services</small>
          </div>
        </div>

        <div className="client-service-stat">
          <span className="service-stat-icon green">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p>Active services</p>
            <strong>{activeCount}</strong>
            <small>Running normally</small>
          </div>
        </div>

        <div className="client-service-stat">
          <span className="service-stat-icon purple">
            <Sparkles size={22} />
          </span>
          <div>
            <p>Domains</p>
            <strong>{domainCount}</strong>
            <small>Renewal monitored</small>
          </div>
        </div>

        <div className="client-service-stat">
          <span className="service-stat-icon orange">
            <LifeBuoy size={22} />
          </span>
          <div>
            <p>Needs attention</p>
            <strong>{pendingCount}</strong>
            <small>Pending or review</small>
          </div>
        </div>
      </section>

      <section className="client-services-panel">
        <div className="client-services-head">
          <div>
            <div className="client-services-title-row">
              <h2>Your Services</h2>
              <span>{filteredServices.length}</span>
            </div>
            <p>Search, filter and manage every active product in your account.</p>
          </div>

          <Link className="client-add-service" href="/client/order">
            <Plus size={18} />
            Add Service
          </Link>
        </div>

        <div className="client-service-controls">
          <div className="client-service-filter-tabs">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={activeFilter === filter.key ? "active" : ""}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="client-service-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search services, domains, packages..."
            />
          </label>
        </div>

        <div className="client-service-table">
          <div className="client-service-table-head">
            <span>Service</span>
            <span>Status</span>
            <span>Plan</span>
            <span>Renews</span>
            <span>Performance</span>
            <span>Actions</span>
          </div>

          {filteredServices.map((service) => {
            const Icon = getServiceIcon(service);
            const tone = getServiceTone(service);
            const score = getPerformanceScore(service);
            const isOpen = openActionId === service.id;

            return (
              <div className="client-service-row" key={service.id}>
                <div className="client-service-main">
                  <span className={`client-service-icon ${tone}`}>
                    <Icon size={22} />
                  </span>
                  <div>
                    <Link href={`/client/services/${service.id}`}>
                      {service.label}
                    </Link>
                    <small>{service.product} · {service.id}</small>
                  </div>
                </div>

                <div>
                  <span className={getStatusClass(service.status)}>
                    <i />
                    {service.status}
                  </span>
                </div>

                <div className="client-service-plan">
                  <strong>{service.package}</strong>
                  <small>{service.term}</small>
                </div>

                <div className="client-service-renewal">
                  <strong>{service.renews}</strong>
                  <small>Auto-renew ready</small>
                </div>

                <div className="client-performance">
                  <strong>{score}</strong>
                  <span
                    style={{
                      background: `conic-gradient(#29be3e ${score * 3.6}deg, #e5edf7 0deg)`,
                    }}
                  >
                    <i />
                  </span>
                </div>

                <div className="client-service-actions-wrap">
                  <div className="client-service-actions">
                    <Link href={`/client/services/${service.id}`}>Manage</Link>

                    <button
                      type="button"
                      aria-label={`More actions for ${service.label}`}
                      aria-expanded={isOpen}
                      onClick={() => setOpenActionId(isOpen ? null : service.id)}
                    >
                      <ChevronDown
                        size={17}
                        className={isOpen ? "client-action-chevron open" : "client-action-chevron"}
                      />
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="client-service-action-menu">
                      <Link href={`/client/services/${service.id}`}>
                        <Settings2 size={16} />
                        Service details
                      </Link>

                      <Link href={`/client/order/checkout?service=${service.id}&action=renew`}>
                        <RefreshCcw size={16} />
                        Renew or upgrade
                      </Link>

                      <Link href={`/client/invoices`}>
                        <CreditCard size={16} />
                        View invoices
                      </Link>

                      <Link href={`/client/support/new?service=${service.id}`}>
                        <LifeBuoy size={16} />
                        Request support
                      </Link>

                      <Link href={`/client/services/${service.id}`}>
                        <ExternalLink size={16} />
                        Open management
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {filteredServices.length === 0 ? (
            <div className="client-service-empty">
              <LayoutGrid size={28} />
              <h3>No service found</h3>
              <p>Try another filter or search term.</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
