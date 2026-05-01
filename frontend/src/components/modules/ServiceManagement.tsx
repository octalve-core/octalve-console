import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { services } from "@/lib/platform-data";
import { Activity, Database, Folder, Globe2, HardDrive, Mail, RefreshCw, ShieldCheck, UploadCloud, Zap } from "lucide-react";

function Usage({ label, value }: { label: string; value: number }) {
  return <div className="grid" style={{ gap: 8 }}><div className="actions" style={{ justifyContent: "space-between" }}><span>{label}</span><span>{value}%</span></div><div className="usage-bar"><span style={{ width: `${value}%` }} /></div></div>;
}

export function ServiceManagement({ id = "SVC-HOST-001" }: { id?: string }) {
  const service = services.find((item) => item.id === id) || services[0];
  const usage = service.usage as Record<string, number>;
  return (
    <div className="grid">
      <Card padded>
        <div className="plan-top">
          <div>
            <div className="actions"><h2 className="card-title">{service.package}</h2><Badge tone="green">{service.status}</Badge><Badge>{service.adapter}</Badge></div>
            <p className="card-sub">{service.product} — {service.label} — renews {service.renews}</p>
          </div>
          <div className="page-actions"><Button variant="secondary">Open Panel</Button><Button>Run Sync</Button></div>
        </div>
      </Card>
      <div className="management-grid">
        <Card>
          <CardHeader title="Service management" subtitle="Client-facing tools for hosting, VPS, DNS, files, usage, backups and migration." />
          <CardBody>
            <div className="grid cols-2">
              {[
                [Globe2, "DNS Manager", "Manage zones, nameservers and DNS records through Cloudflare or registrar adapters."],
                [Folder, "File Manager", "Connect hosting file actions or link into DirectAdmin file manager."],
                [Activity, "Usage", "Disk, bandwidth, CPU, memory, database and email usage metrics."],
                [Mail, "Email Accounts", "Create mailboxes, aliases, forwarders and quota rules."],
                [ShieldCheck, "SSL", "Issue, install, renew and verify SSL certificates."],
                [UploadCloud, "Migration", "Submit migration request, source details and status tracking."],
                [Zap, "VPS Power", "Start, stop, restart, rebuild, snapshots and console actions."],
                [Database, "Databases", "Create databases, users and backup/restore actions."],
              ].map(([Icon, title, text]) => {
                const RealIcon = Icon as typeof Globe2;
                return <div className="card pad" key={String(title)}><div className="avatar"><RealIcon size={18} /></div><h3 className="card-title" style={{ marginTop: 14 }}>{String(title)}</h3><p className="card-sub" style={{ lineHeight: 1.55 }}>{String(text)}</p></div>;
              })}
            </div>
          </CardBody>
        </Card>
        <div className="grid">
          <Card>
            <CardHeader title="Usage snapshot" subtitle="Mock now, later synced from adapter API." />
            <CardBody>
              <div className="grid">
                <Usage label="Disk" value={usage.disk || 0} />
                <Usage label="Bandwidth" value={usage.bandwidth || 0} />
                <Usage label="Email" value={usage.email || usage.cpu || 0} />
                <Usage label="Database / Memory" value={usage.database || usage.memory || 0} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Provisioning actions" subtitle="Admin/staff actions should run through queues." />
            <CardBody>
              <div className="grid">
                <Button><RefreshCw size={16} /> Sync from provider</Button>
                <Button variant="secondary">Suspend</Button>
                <Button variant="secondary">Unsuspend</Button>
                <Button variant="danger">Terminate</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
