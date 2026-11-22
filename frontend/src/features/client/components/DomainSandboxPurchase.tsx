"use client";

import { useEffect, useState } from "react";

const endpoint = "/api/cloud/domains/sandbox-purchase/";
type Purchase = {
  order: string;
  invoice: string;
  domain: string;
  amount: string;
  state: "awaiting_payment" | "registration_pending" | "registered";
  payment_reference?: string;
};
type Overview = { domain: string; purchase: Purchase | null };
type Quote = { quote: string; amount: string };
const labels = {
  awaiting_payment: "Awaiting test payment",
  registration_pending: "Test payment verified. Registration pending.",
  registered: "Sandbox domain registered",
};

export function DomainSandboxPurchase({ admin = false }: { admin?: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (response.ok) setOverview(await response.json());
      } catch {
        // The purchase control is only available to eligible accounts.
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function submit(action: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "accept" ? { action, quote: quote?.quote } : { action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.detail === "string" ? data.detail : "This step could not be confirmed. Refresh to check the current status.");
        return;
      }
      if (action === "quote") setQuote(data);
      else if (action === "checkout") window.location.assign(data.checkout_url);
      else setOverview({ domain: data.domain, purchase: data });
    } catch {
      setError("The connection was interrupted. Refresh to check the current status.");
    } finally {
      setBusy(false);
    }
  }

  if (!overview) return null;
  const purchase = overview.purchase;
  const buttons = !purchase
    ? [{ action: quote ? "accept" : "quote", text: quote ? "Accept quote" : "Check sandbox availability" }]
    : [
        ...(purchase.state === "awaiting_payment" ? [{ action: "checkout", text: "Pay with Paystack Test Mode" }] : []),
        ...(purchase.state === "registered" ? [] : [{ action: "reconcile", text: "Confirm payment and registration" }]),
      ];

  return (
    <section className="space-y-3 rounded-xl border border-console-line bg-white p-4 text-sm">
      <h2 className="font-medium">Sandbox domain purchase</h2>
      <p>{overview.domain} · One year{quote && !purchase ? ` · NGN ${quote.amount}` : ""}</p>
      {purchase && (
        <div role="status" className="space-y-1">
          <p>{labels[purchase.state]}</p>
          <p>{purchase.order} · {purchase.invoice} · NGN {purchase.amount}</p>
          {purchase.payment_reference && <p>Paystack test reference {purchase.payment_reference}</p>}
        </div>
      )}
      {!admin && (
        <div className="flex flex-wrap gap-2">
          {buttons.map(({ action, text }) => (
            <button key={action} type="button" disabled={busy} onClick={() => void submit(action)}
              className="rounded-lg border border-console-line px-3 py-2 font-medium text-console-primary disabled:opacity-50">
              {text}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </section>
  );
}
