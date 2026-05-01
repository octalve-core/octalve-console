import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { adapters } from "@/lib/platform-data";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Servers & Adapters" description="Connect DirectAdmin, cPanel, Plesk, Proxmox, Virtualizor, Enhance, Pterodactyl, VirtFusion, Cloudflare and provider APIs through a clean adapter layer." actions={<><Button href="/admin/servers/new">+ Add Provider</Button><Button href="/admin/settings/providers" variant="secondary">Provider Settings</Button></>} />
      <div className="grid cols-3">
        {adapters.map((adapter) => (
          <Card padded key={adapter.name}>
            <div className="plan-top"><div><h2 className="card-title">{adapter.name}</h2><p className="card-sub">{adapter.category}</p></div><Badge tone={adapter.tone}>{adapter.status}</Badge></div>
            <p className="card-sub" style={{ lineHeight: 1.6 }}>{adapter.description}</p>
            <div className="page-actions" style={{ marginTop: 18 }}><Button href={`/admin/servers/${adapter.name}`} variant="secondary">Edit</Button><Button href={`/admin/servers/${adapter.name}`}>Test Connection</Button></div>
          </Card>
        ))}
      </div>
    </main>
  );
}
