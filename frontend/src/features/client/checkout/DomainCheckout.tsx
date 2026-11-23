import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DomainSandboxPurchase } from "../components/DomainSandboxPurchase";

export function DomainCheckout({ domain }: { domain?: string }) {
  return (
    <DashboardShell role="client" title="Checkout" description="Review your domain order.">
      <DashboardPage eyebrow="Checkout" title="Review your order"
        description="Check your domain and order total before continuing to payment.">
        <Link href="/client/order/checkout?view=cart" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-console-primary"><ArrowLeft size={16} aria-hidden="true"/> Back to cart</Link>
        <DomainSandboxPurchase key={domain ?? "existing-test-order"} domain={domain} checkoutPage />
      </DashboardPage>
    </DashboardShell>
  );
}
