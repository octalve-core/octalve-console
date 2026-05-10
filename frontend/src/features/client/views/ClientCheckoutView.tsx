"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { clientApi } from "@/lib/api/endpoints";
import { formatCurrency } from "@/lib/formatters";
import { clientOrderPlans } from "../data/client-order-data";

export function ClientCheckoutView() {
  const [planId, setPlanId] = useState(clientOrderPlans[0]?.id ?? "");
  const [domain, setDomain] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("paystack");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const plan = searchParams.get("plan");

    if (plan) {
      setPlanId(plan);
    }
  }, []);

  const selectedPlan = useMemo(() => {
    return clientOrderPlans.find((plan) => plan.id === planId) ?? clientOrderPlans[0];
  }, [planId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsSubmitting(true);

    try {
      await clientApi.createOrder({
        plan_id: selectedPlan?.id,
        product: selectedPlan?.product,
        domain,
        payment_method: paymentMethod,
        total: selectedPlan?.price,
      });

      setNotice("Order created successfully. Payment initialization can now be connected to the selected gateway.");
    } catch {
      setError("The order API is not available yet or rejected the current payload. The checkout UI is ready for integration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardShell
      role="client"
      title="Checkout"
      description="Complete your service order securely."
    >
      <DashboardPage
        eyebrow="Checkout"
        title="Complete your order"
        description="Confirm your service details and payment method. This page is ready for Paystack, Flutterwave, wallet, and manual transfer integration."
      >
        <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <div className="grid gap-5">
              <div>
                <label htmlFor="plan" className="block text-sm font-medium text-slate-700">
                  Selected plan
                </label>
                <select
                  id="plan"
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                >
                  {clientOrderPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-slate-700">
                  Domain or project name
                </label>
                <input
                  id="domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="example.com"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                  required
                />
              </div>

              <div>
                <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700">
                  Payment method
                </label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                >
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                  <option value="wallet">Wallet</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>

              {notice ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                  {notice}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-end border-t border-slate-200 pt-5">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Create order
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Order summary</h3>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">{selectedPlan?.name}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedPlan?.product}</p>
                <p className="mt-4 text-3xl font-medium tracking-[-0.05em] text-slate-950">
                  {formatCurrency(selectedPlan?.price ?? 0)}
                </p>
              </div>
            </Card>

            <Card>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">Secure checkout</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Checkout is prepared for invoice-first ordering, gateway initialization, wallet payment, and manual approval.
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <LockKeyhole className="h-4 w-4" />
                API-ready payment flow
              </div>
            </Card>
          </div>
        </form>
      </DashboardPage>
    </DashboardShell>
  );
}