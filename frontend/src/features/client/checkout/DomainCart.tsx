import Link from "next/link";
import { ArrowRight, CalendarDays, Globe2, Server, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/design-system/Panel";
import { formatPlanAmount } from "../data/client-order-data";

type Action = { action: string; text: string };

export function checkoutDate(value?: string | null) {
  if (!value) return "Pending confirmation";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending confirmation" : new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium", timeZone: "Africa/Lagos",
  }).format(date);
}

export function DomainCart({domain, amount, status, order, invoice, registeredAt, expiresAt, paymentVerified, actions, busy, error, onAction}: {
  domain: string; amount?: string; status?: string; order?: string; invoice?: string;
  registeredAt?: string | null; expiresAt?: string | null; paymentVerified: boolean;
  actions: readonly Action[]; busy: boolean; error: string; onAction: (action: string) => void;
}) {
  const price = amount && Number.isFinite(Number(amount)) ? formatPlanAmount(Number(amount), "NGN") : null;
  const step = paymentVerified ? "Confirmation" : order ? "Payment" : "Review";
  return <div id="sandbox-domain-purchase" className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
    <ol aria-label="Checkout progress" className="grid grid-cols-3 gap-2 xl:col-span-2">
      {["Review", "Payment", "Confirmation"].map(label=><li key={label} aria-current={label===step?"step":undefined}
        className={label===step?"rounded-lg bg-blue-50 px-2 py-2 text-center text-xs font-medium text-console-primary sm:text-sm":"px-2 py-2 text-center text-xs text-console-muted sm:text-sm"}>{label}</li>)}
    </ol>
      <Panel className="min-w-0 overflow-hidden xl:col-start-1">
        <div className="flex flex-wrap items-start gap-4">
          <span className="rounded-xl bg-blue-50 p-3 text-console-primary"><Globe2 aria-hidden="true" className="h-6 w-6"/></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-console-muted">Domain registration</p>
            <h2 className="mt-1 break-all text-xl font-medium text-console-ink sm:text-2xl">{domain}</h2>
            <p className="mt-1 text-sm text-console-muted">One-year term</p>
          </div>
          {price && <p className="text-lg font-medium tabular-nums text-console-ink">{price}</p>}
        </div>
        <div className="mt-5 border-t border-console-line pt-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-2 text-xs text-console-muted"><CalendarDays className="h-4 w-4" aria-hidden="true"/>Registration date</dt>
              <dd className="mt-1 text-sm font-medium text-console-ink">{checkoutDate(registeredAt)}</dd></div>
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-console-muted">Expiry date</dt>
              <dd className="mt-1 text-sm font-medium text-console-ink">{checkoutDate(expiresAt)}</dd></div>
          </dl>
          {status && <p role="status" className="mt-4 text-sm font-medium text-console-ink">{status}</p>}
          {order && <p className="mt-1 break-words text-xs text-console-muted">{order}{invoice ? ` · ${invoice}` : ""}</p>}
        </div>
      </Panel>
    <Panel className="min-w-0 xl:sticky xl:top-24 xl:row-span-2">
      <h2 className="text-lg font-medium">Order summary</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <div className="flex items-start justify-between gap-3"><dt className="text-console-muted">Item</dt><dd className="min-w-0 break-all text-right">{domain}</dd></div>
        <div className="flex items-center justify-between gap-3 border-t border-console-line pt-4"><dt className="font-medium">Order total</dt><dd className="text-lg font-medium tabular-nums">{price ?? "Pending quote"}</dd></div>
      </dl>
      <p className="mt-3 flex items-center gap-2 text-xs text-console-muted"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/>Test checkout. No money will be charged.</p>
      <div className="mt-4 space-y-2">
        {actions.map((action, index) => <button key={action.action} type="button" disabled={busy} onClick={() => onAction(action.action)}
          className={index === 0 ? "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-console-primary px-3 text-sm font-medium text-white disabled:opacity-50" : "min-h-11 w-full rounded-lg border border-console-line px-3 text-sm font-medium text-console-primary disabled:opacity-50"}>
          {busy && index === 0 ? "Working…" : action.text}{!busy && index === 0 && <ArrowRight aria-hidden="true" className="h-4 w-4"/>}
        </button>)}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </Panel>
    <div className="min-w-0 space-y-2 xl:col-start-1">
      <Panel className="flex flex-wrap items-center gap-4">
        <Server aria-hidden="true" className="h-5 w-5 text-console-primary"/>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">Add web hosting</h3><p className="mt-1 text-xs text-console-muted">Optional. Browse plans for this domain.</p></div>
        <Link href="/client/order" className="inline-flex min-h-11 items-center rounded-lg border border-console-line px-3 text-sm font-medium text-console-primary">Explore hosting</Link>
      </Panel>
      <Link href="/client/domains/register" className="inline-flex min-h-11 items-center text-sm font-medium text-console-primary">Choose a different domain</Link>
    </div>
  </div>;
}
