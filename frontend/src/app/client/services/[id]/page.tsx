import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileArchive,
  Globe2,
  HardDrive,
  Headphones,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  TerminalSquare,
  Zap
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { domains, services } from "@/lib/platform-data";

function getServiceStatusClass(status: string) {
  if (status === "Active") return "badge green";
  if (status === "Pending") return "badge orange";
  if (status === "Suspended") return "badge red";
  return "badge";
}

function getServiceType(product: string) {
  const value = product.toLowerCase();

  if (value.includes("vps")) return "VPS";
  if (value.includes("domain")) return "Domain";
  if (value.includes("email")) return "Email";
  if (value.includes("ssl")) return "SSL";
  if (value.includes("backup")) return "Backup";
  return "Hosting";
}

function getServiceIcon(product: string) {
  const type = getServiceType(product);

  if (type === "VPS") return Server;
  if (type === "Domain") return Globe2;
  if (type === "Email") return Mail;
  if (type === "SSL") return ShieldCheck;
  if (type === "Backup") return FileArchive;
  return Zap;
}

function getPrimaryModules(product: string, domainHref: string) {
  const type = getServiceType(product);

  if (type === "VPS") {
    return [
      {
        title: "Server power",
        description: "Start, stop, reboot and monitor your virtual server.",
        icon: TerminalSquare,
        href: "#server-power"
      },
      {
        title: "Usage monitor",
        description: "Track CPU, memory, disk and bandwidth usage.",
        icon: Activity,
        href: "#usage"
      },
      {
        title: "Backups",
        description: "Review backup availability and request restore support.",
        icon: FileArchive,
        href: "#backups"
      }
    ];
  }

  if (type === "Domain") {
    return [
      {
        title: "DNS records",
        description: "Manage A, CNAME, MX, TXT and other DNS records.",
        icon: Globe2,
        href: domainHref
      },
      {
        title: "Renewal settings",
        description: "Control auto-renewal and renew before expiry.",
        icon: RefreshCw,
        href: domainHref
      },
      {
        title: "Domain security",
        description: "Check lock, privacy and domain protection status.",
        icon: Lock,
        href: domainHref
      }
    ];
  }

  return [
    {
      title: "Website files",
      description: "Access files, databases and hosting resources.",
      icon: HardDrive,
      href: "#files"
    },
    {
      title: "Email accounts",
      description: "Create and manage professional mailbox accounts.",
      icon: Mail,
      href: "#email"
    },
    {
      title: "SSL and security",
      description: "Review SSL status and website protection settings.",
      icon: ShieldCheck,
      href: "#security"
    }
  ];
}

export default function Page({ params }: { params: { id: string } }) {
  const service = services.find((item) => item.id === params.id) ?? services[0];
  const Icon = getServiceIcon(service.product);
  const serviceType = getServiceType(service.product);
  const usageEntries = Object.entries((service.usage ?? {}) as unknown as Record<string, number>);

  const linkedDomain =
    domains.find((domain) => domain.domain === service.label) ??
    domains.find((domain) => service.label.includes(domain.domain)) ??
    domains[0];

  const domainHref = `/client/domains/${linkedDomain.id}`;
  const primaryModules = getPrimaryModules(service.product, domainHref);

  return (
    <main className="page-container client-service-detail-page">
      <PageHeader
        title={service.label}
        description={`${service.product} service management, renewals, security and support.`}
        actions={
          <div className="page-actions">
            <Link href="/client/support/new" className="button secondary">
              Get Support
            </Link>
            <Link href="/client/order/checkout" className="button">
              Renew / Upgrade
            </Link>
          </div>
        }
      />

      <div className="client-service-detail-grid">
        <Card padded>
          <div className="client-service-hero">
            <div className="client-service-hero-icon">
              <Icon size={30} />
            </div>

            <div>
              <p className="eyebrow">{serviceType}</p>
              <h2>{service.label}</h2>
              <p>{service.product} · {service.package}</p>
            </div>

            <span className={getServiceStatusClass(service.status)}>{service.status}</span>
          </div>

          <div className="client-service-meta-grid large">
            <div>
              <span>Service ID</span>
              <strong>{service.id}</strong>
            </div>

            <div>
              <span>Billing term</span>
              <strong>{service.term}</strong>
            </div>

            <div>
              <span>Next renewal</span>
              <strong>{service.renews}</strong>
            </div>
          </div>

          {usageEntries.length ? (
            <div className="client-service-usage-list detail" id="usage">
              {usageEntries.map(([key, value]) => (
                <div key={key}>
                  <div className="usage-row">
                    <span>{key}</span>
                    <strong>{value}%</strong>
                  </div>

                  <div className="usage-track">
                    <span className="usage-fill" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Common actions for this service.</p>
            </div>
          </div>

          <div className="client-quick-actions">
            <button type="button">
              <RefreshCw size={18} />
              Refresh status
            </button>

            <Link href="/client/support/new">
              <Headphones size={18} />
              Open support ticket
            </Link>

            <Link href="/client/order/checkout">
              <ArrowUpRight size={18} />
              Upgrade service
            </Link>

            {serviceType === "Domain" ? (
              <Link href={domainHref}>
                <Globe2 size={18} />
                Manage DNS
              </Link>
            ) : (
              <button type="button">
                <Lock size={18} />
                Change password
              </button>
            )}
          </div>
        </Card>
      </div>

      <div className="client-management-grid">
        {primaryModules.map((module) => {
          const ModuleIcon = module.icon;

          return (
            <Link className="client-management-card" href={module.href} key={module.title}>
              <div>
                <div className="client-management-icon">
                  <ModuleIcon size={21} />
                </div>

                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </div>

              <ArrowUpRight size={18} />
            </Link>
          );
        })}
      </div>

      <div className="client-service-lower-grid">
        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Service health</h2>
              <p>Current service condition and protection summary.</p>
            </div>
          </div>

          <div className="health-list">
            <div>
              <CheckCircle2 size={18} />
              <span>Status</span>
              <strong>{service.status}</strong>
            </div>

            <div>
              <ShieldCheck size={18} />
              <span>SSL / security</span>
              <strong>{serviceType === "Hosting" || serviceType === "Domain" ? "Protected" : "Available"}</strong>
            </div>

            <div>
              <RefreshCw size={18} />
              <span>Renewal</span>
              <strong>{service.renews}</strong>
            </div>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Recommended add-ons</h2>
              <p>Add services that improve reliability, trust and continuity.</p>
            </div>
          </div>

          <div className="addon-list">
            <Link href="/client/order/checkout?category=security">
              <ShieldCheck size={18} />
              SSL protection
            </Link>

            <Link href="/client/order/checkout?category=email">
              <Mail size={18} />
              Business email
            </Link>

            <Link href="/client/order/checkout?category=hosting">
              <BarChart3 size={18} />
              Backup and monitoring
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

