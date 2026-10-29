import { gateways } from "@/lib/platform-data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function GatewayCards() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {gateways.map((gateway) => (
        <Card padded key={gateway.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-console-ink">{gateway.name}</h2>
              <p className="mt-1 text-[13px] leading-5 text-console-muted">{gateway.summary}</p>
            </div>
            <Badge tone={gateway.tone}>{gateway.status}</Badge>
          </div>
          <ul className="mt-3 list-inside list-disc space-y-1 text-[13px] leading-5 text-console-muted">
            {gateway.fields.slice(0, 4).map((field) => <li key={field}>{field}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button href={`/admin/gateways/${gateway.id}`}>Edit Configuration</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
