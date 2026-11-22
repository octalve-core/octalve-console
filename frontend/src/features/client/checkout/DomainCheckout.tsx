import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { WorkspaceGrid } from "@/components/design-system/WorkspaceGrid";
import { Panel } from "@/components/design-system/Panel";
import { DomainSandboxPurchase } from "../components/DomainSandboxPurchase";

export function DomainCheckout({ domain }: { domain: string }) {
  return (
    <DashboardShell role="client" title="Checkout" description="Review your domain order.">
      <DashboardPage eyebrow="Checkout" title="Register your domain"
        description="Review the registration quote, then continue to payment.">
        <WorkspaceGrid variant="commerceColumns">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <DomainSandboxPurchase key={domain} domain={domain} checkoutPage />
            <Link href="/client/domains/register" className="text-sm font-medium text-console-primary">Search for another domain</Link>
          </div>
          <Panel className="self-start">
            <h2 className="font-medium">Order summary</h2>
            <p className="mt-3 break-all text-sm font-medium">{domain}</p>
            <p className="mt-1 text-sm text-console-muted">Domain registration · One year</p>
            <p className="mt-4 text-sm text-console-muted">Paystack Test Mode · Cloudflare Sandbox</p>
          </Panel>
        </WorkspaceGrid>
      </DashboardPage>
    </DashboardShell>
  );
}
