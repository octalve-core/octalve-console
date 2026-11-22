"use client";

import { useEffect, useState } from "react";

const endpoint = "/api/cloud/domains/sandbox-purchase/";
type Purchase = {
  order: string;
  invoice: string;
  domain: string;
  amount: string;
  state: keyof typeof labels;
  checkout_state: "available" | "resume" | "uncertain" | "expired";
  payment_reference?: string;
};
type Overview = { domain: string; purchase: Purchase | null; readiness_issues?: string[] | null };
type Quote = { quote: string; amount: string };
const labels = {
  awaiting_payment: "Awaiting test payment",
  registration_uncertain: "Test payment verified. Registrar response unconfirmed.",
  registration_rejected: "Test payment verified. Registrar rejected the registration.",
  registration_action_required: "Test payment verified. Check Cloudflare for the required action.",
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
        const status = await fetch(endpoint, { cache: "no-store" });
        if (status.ok) setOverview(await status.json());
        return;
      }
      if (action === "quote") setQuote(data);
      else if (action === "checkout") window.location.assign(data.checkout_url);
      else setOverview((current) => current ? { ...current, purchase: data } : current);
    } catch {
      setError("The connection was interrupted. Refresh to check the current status.");
    } finally {
      setBusy(false);
    }
  }

  if (!overview) return null;
  const purchase = overview.purchase;
  const awaitingPayment = purchase?.state === "awaiting_payment";
  const canCheckout = awaitingPayment && ["available", "resume"].includes(purchase.checkout_state);
  const terminal = purchase && ["registered", "registration_rejected"].includes(purchase.state);
  const buttons = !purchase
    ? [
        ...(quote ? [{ action: "accept", text: "Accept quote" }] : []),
        { action: "quote", text: quote ? "Get a fresh quote" : "Check sandbox availability" },
      ]
    : [
        ...(canCheckout ? [{
          action: "checkout",
          text: purchase.checkout_state === "resume" ? "Resume Paystack test checkout" : "Pay with Paystack Test Mode",
        }] : []),
        ...(!terminal && (!awaitingPayment || purchase.checkout_state !== "available") ? [{
          action: "reconcile",
          text: awaitingPayment ? "Check existing Paystack reference" : "Check registrar status",
        }] : []),
      ];

  return (
    <section className="space-y-3 rounded-xl border border-console-line bg-white p-4 text-sm">
      <h2 className="font-medium">Sandbox domain purchase</h2>
      <p>{overview.domain} · One year{quote && !purchase ? ` · NGN ${quote.amount}` : ""}</p>
      {admin && overview.readiness_issues && (
        overview.readiness_issues.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {overview.readiness_issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : (
          <p>Console preflight passed. Confirm the Test Mode webhook URL in Paystack.</p>
        )
      )}
      {purchase && (
        <div role="status" className="space-y-1">
          <p>{labels[purchase.state]}</p>
          {awaitingPayment && purchase.checkout_state === "expired" &&
            <p>Checkout expired. Check the existing reference in Paystack Test Mode.</p>}
          {awaitingPayment && purchase.checkout_state === "uncertain" &&
            <p>Checkout was interrupted. Check the existing reference before proceeding.</p>}
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
