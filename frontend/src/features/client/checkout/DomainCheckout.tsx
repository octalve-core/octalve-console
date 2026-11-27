import { DashboardShell } from "@/components/layout/DashboardShell";
import { DomainSandboxPurchase } from "../components/DomainSandboxPurchase";

export function DomainCheckout({ domain, invoiceId }: { domain?: string; invoiceId?:number }) {
  return <DashboardShell role="client" title="Checkout" description="Review your domain order.">
    <DomainSandboxPurchase key={invoiceId??domain??"existing-test-order"} domain={domain} invoiceId={invoiceId} checkoutPage />
  </DashboardShell>;
}
