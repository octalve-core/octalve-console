import { plans } from "@/lib/platform-data";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CheckCircle2 } from "lucide-react";

export function PlanCards({ admin = false }: { admin?: boolean }) {
  return (
    <div className="grid cols-2">
      {plans.map((plan) => (
        <Card padded key={plan.id}>
          <div className="plan-top">
            <div>
              <div className="actions"><h2 className="card-title">{plan.name}</h2><span className="card-sub">{plan.product}</span>{plan.popular ? <Badge tone="orange">Popular</Badge> : null}<Badge tone="green">Active</Badge></div>
              <div className="price">{money(plan.price)}<span style={{ fontSize: 14, color: "#64748b" }}>/{plan.cycle}</span></div>
            </div>
            <Badge>{plan.adapter}</Badge>
          </div>
          <div className="actions" style={{ color: "#64748b", marginBottom: 14 }}>
            <span>{plan.storage}</span><span>{plan.bandwidth}</span><span>{plan.websites}</span>{plan.ssl ? <span style={{ color: "#13822a" }}>Free SSL</span> : null}
          </div>
          <ul className="feature-list">
            {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
          <div className="cycle-grid">
            {plan.cycles.map((cycle) => <div className="cycle" key={cycle.label}><div className="card-sub">{cycle.label}</div><div>{money(cycle.price)}</div></div>)}
          </div>
          <div className="page-actions" style={{ marginTop: 18 }}>
            {admin ? <><Button href={`/admin/plans/${plan.id}`} variant="secondary">Edit</Button><Button href={`/admin/plans/${plan.id}`}>Manage</Button></> : <Button href={`/client/order/checkout?plan=${plan.id}`}><CheckCircle2 size={17} /> Order now</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}
