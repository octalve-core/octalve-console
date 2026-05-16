import { gateways } from "@/lib/platform-data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function GatewayCards() {
  return (
    <div className="grid cols-3">
      {gateways.map((gateway) => (
        <Card padded key={gateway.id}>
          <div className="plan-top">
            <div>
              <h2 className="card-title">{gateway.name}</h2>
              <p className="card-sub" style={{ lineHeight: 1.55 }}>{gateway.summary}</p>
            </div>
            <Badge tone={gateway.tone}>{gateway.status}</Badge>
          </div>
          <ul className="feature-list">
            {gateway.fields.slice(0, 4).map((field) => <li key={field}>{field}</li>)}
          </ul>
          <div className="page-actions" style={{ marginTop: 18 }}>
            <Button href={`/admin/gateways/${gateway.id}`}>Edit Configuration</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
