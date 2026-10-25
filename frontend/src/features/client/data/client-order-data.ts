import { publicApi } from "@/lib/api/endpoints";

export type OrderCycle = {
  key: string; label: string; price: number; setupFee: number; isDefault: boolean;
};
export type ClientOrderPlan = {
  id: string; name: string; product: string; description: string;
  currency: string; features: string[]; popular: boolean; cycles: OrderCycle[];
};

type ApiCycle = {cycle_key: string; label: string; price: string; setup_fee: string; is_active: boolean; is_default: boolean};
type ApiPlan = {
  id: number; name: string; product_name: string; product_type: string;
  description?: string; currency: string; status: string; is_public: boolean;
  is_popular: boolean; features: {label: string; value: string}[];
  billing_cycles: ApiCycle[];
};

export async function loadSellablePlans(): Promise<ClientOrderPlan[]> {
  const response: unknown = await publicApi.plans();
  const raw = Array.isArray(response) ? response :
    (response && typeof response === "object" && "results" in response
      ? (response as {results: unknown}).results : []);
  if (!Array.isArray(raw)) throw new Error("Catalog returned an invalid plan list.");
  return (raw as ApiPlan[]).filter(p =>
    p.status === "active" && p.is_public &&
    ["shared_hosting", "wordpress_hosting", "vps"].includes(p.product_type)
  ).map(p => ({
    id: String(p.id), name: p.name, product: p.product_name || "Hosting",
    description: p.description || "", currency: p.currency,
    popular: p.is_popular,
    features: (p.features || []).map(f => [f.label, f.value].filter(Boolean).join(": ")),
    cycles: (p.billing_cycles || []).filter(c => c.is_active && Number(c.price) > 0)
      .map(c => ({key:c.cycle_key,label:c.label,price:Number(c.price),
        setupFee:Number(c.setup_fee || 0),isDefault:c.is_default})),
  })).filter(p => p.cycles.length > 0);
}

export function formatPlanAmount(value: number, currency: string): string {
  try { return new Intl.NumberFormat("en-NG", {style:"currency",currency}).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

export function defaultCycle(plan: ClientOrderPlan | undefined): OrderCycle | undefined {
  return plan?.cycles.find(c => c.isDefault) || plan?.cycles[0];
}
