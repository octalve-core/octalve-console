import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { services } from "@/lib/platform-data";

type ServiceRecord = (typeof services)[number];

export type ServiceManagementProps = {
  id?: string;
  service?: ServiceRecord;
};

function formatUsageLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getUsageEntries(service: ServiceRecord): Array<[string, number]> {
  return Object.entries(service.usage).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number"
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function findServiceById(id?: string) {
  if (!id) return services[0];

  return (
    services.find((item) => item.id === id) ||
    services.find((item) => item.id.toLowerCase() === id.toLowerCase()) ||
    services[0]
  );
}

export function ServiceManagement({ id, service }: ServiceManagementProps) {
  const selectedService = service || findServiceById(id);
  const usageEntries = getUsageEntries(selectedService);

  return (
    <div className="space-y-6">
      <Card padded>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{selectedService.product}</p>
            <h2>{selectedService.label}</h2>
            <p>
              {selectedService.package} · {selectedService.term} · Renews{" "}
              {selectedService.renews}
            </p>
          </div>

          <Badge tone={selectedService.status === "Active" ? "green" : "orange"}>
            {selectedService.status}
          </Badge>
        </div>

        <div className="info-grid">
          <div>
            <span>Service ID</span>
            <strong>{selectedService.id}</strong>
          </div>
          <div>
            <span>Customer</span>
            <strong>{selectedService.customer}</strong>
          </div>
          <div>
            <span>Adapter</span>
            <strong>{selectedService.adapter}</strong>
          </div>
          <div>
            <span>Renewal</span>
            <strong>{selectedService.renews}</strong>
          </div>
        </div>
      </Card>

      <Card padded>
        <div className="section-heading">
          <div>
            <h2>Service Controls</h2>
            <p>
              These actions are prepared for the backend adapter layer. The
              backend developer will connect each button to real API endpoints.
            </p>
          </div>
        </div>

        <div className="action-grid">
          <Button type="button">Open Control Panel</Button>
          <Button type="button" variant="secondary">
            Change Password
          </Button>
          <Button type="button" variant="secondary">
            Request Migration
          </Button>
          <Button type="button" variant="secondary">
            View Backups
          </Button>
          <Button type="button" variant="secondary">
            Suspend
          </Button>
          <Button type="button" variant="secondary">
            Cancel Service
          </Button>
        </div>
      </Card>

      <Card padded>
        <div className="section-heading">
          <div>
            <h2>Usage Overview</h2>
            <p>
              Disk, bandwidth, email, database, CPU, memory, DNS and renewal
              usage can all be synced from the selected adapter.
            </p>
          </div>
        </div>

        <div className="usage-list">
          {usageEntries.map(([key, value]) => (
            <div className="usage-item" key={key}>
              <div className="usage-row">
                <span>{formatUsageLabel(key)}</span>
                <strong>{value}%</strong>
              </div>
              <div className="usage-track">
                <div
                  className="usage-fill"
                  style={{ width: `${clampPercent(value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padded>
        <div className="section-heading">
          <div>
            <h2>Management Areas</h2>
            <p>
              This service page is ready for DNS, file manager, usage history,
              backups, invoices, tickets and adapter activity.
            </p>
          </div>
        </div>

        <div className="module-grid">
          {[
            "DNS Management",
            "File Manager",
            "Usage History",
            "Backups",
            "Invoices",
            "Support Tickets",
          ].map((item) => (
            <div className="module-card" key={item}>
              <h3>{item}</h3>
              <p>Prepared for live backend integration.</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
