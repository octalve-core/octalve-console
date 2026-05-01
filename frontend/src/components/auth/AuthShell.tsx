import { BrandMark } from "@/components/layout/BrandMark";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <div className="brand-row">
          <BrandMark />
          <div>
            <div className="brand-name">Octalve Console</div>
            <div className="brand-sub">Cloud business OS</div>
          </div>
        </div>
        <div className="auth-copy">
          <h1>Premium hosting business console for Octalve Cloud.</h1>
          <p>Billing, domains, hosting, adapters, gateways, wallet, support and client management in one future-ready platform.</p>
        </div>
        <div className="auth-bars"><span /><span /><span /><span /></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>{title}</h2>
          <p>{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
