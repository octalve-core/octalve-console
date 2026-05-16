"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency } from "@/lib/formatters";
import { clientOrderPlans } from "../data/client-order-data";

export function ClientOrderView() {
  const [selectedPlanId, setSelectedPlanId] = useState(clientOrderPlans[0]?.id ?? "");
  const selectedPlan = clientOrderPlans.find((plan) => plan.id === selectedPlanId) ?? clientOrderPlans[0];

  return (
    <DashboardShell
      role="client"
      title="Order service"
      description="Choose hosting, VPS, email, or domain services for your business."
    >
      <DashboardPage
        eyebrow="Order"
        title="Choose a service"
        description="Select a service plan and continue to checkout. The checkout flow is API-ready for Django orders and payments."
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <div className="grid gap-5 lg:grid-cols-3">
            {clientOrderPlans.map((plan) => {
              const selected = plan.id === selectedPlanId;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`rounded-[1.5rem] border bg-white p-5 text-left shadow-sm transition ${
                    selected ? "border-[#0064E0] ring-4 ring-[#0064E0]/10" : "border-slate-200 hover:border-[#0064E0]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                      <ShoppingCart className="h-6 w-6" />
                    </div>

                    {plan.popular ? <Badge tone="success">Popular</Badge> : null}
                  </div>

                  <h2 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">{plan.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{plan.description}</p>

                  <p className="mt-5 text-3xl font-medium tracking-[-0.05em] text-slate-950">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-slate-500">/{plan.cycle}</span>
                  </p>

                  <div className="mt-5 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <Card>
            <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Order summary</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review your selected service before continuing to checkout.
            </p>

            {selectedPlan ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">{selectedPlan.name}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedPlan.product}</p>
                <p className="mt-4 text-2xl font-medium tracking-[-0.04em] text-slate-950">
                  {formatCurrency(selectedPlan.price)}
                </p>
              </div>
            ) : null}

            <Button href={`/client/order/checkout?plan=${encodeURIComponent(selectedPlan?.id ?? "")}`} className="mt-5 w-full">
              Continue to checkout
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}