import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DomainSandboxPurchase } from "../components/DomainSandboxPurchase";

export function DomainCheckout({ domain }: { domain?: string }) {
  return (
    <DashboardShell role="client" title="Checkout" description="Review your domain order.">
      <DashboardPage eyebrow="Checkout" title="Review your order"
        description="Check your domain and order total before continuing to payment.">
        <DomainSandboxPurchase key={domain ?? "existing-test-order"} domain={domain} checkoutPage />
      </DashboardPage>
    </DashboardShell>
  );
}
