import { DashboardShell } from "@/components/layout/DashboardShell";
import { DomainSandboxPurchase } from "../components/DomainSandboxPurchase";

export function DomainCheckout({ domain }: { domain?: string }) {
  return <DashboardShell role="client" title="Checkout" description="Review your domain order.">
    <DomainSandboxPurchase key={domain ?? "existing-test-order"} domain={domain} checkoutPage />
  </DashboardShell>;
}
