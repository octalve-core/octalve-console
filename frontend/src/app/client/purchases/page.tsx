import {ShoppingCart,ReceiptText,ArrowRight} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {routes} from "@/lib/routes";

/** Purchases is one friendly sidebar destination; existing routes remain intact. */
export default function ClientPurchasesPage(){
  return <DashboardShell role="client" title="Purchases"
    description="Your orders, invoices and payment history in one place.">
    <DashboardPage eyebrow="Account" title="Purchases"
      description="Review what you have ordered and what is due.">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <ShoppingCart aria-hidden="true" className="h-7 w-7 text-console-primary"/>
          <h2 className="mt-4 text-lg font-medium text-console-ink">Orders</h2>
          <p className="mt-2 text-sm leading-6 text-console-muted">Check submitted orders and their current progress.</p>
          <ActionLink href={routes.client.orders} variant="outline" className="mt-5 w-full sm:w-auto">
            View orders <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4"/>
          </ActionLink>
        </Panel>
        <Panel>
          <ReceiptText aria-hidden="true" className="h-7 w-7 text-console-primary"/>
          <h2 className="mt-4 text-lg font-medium text-console-ink">Invoices</h2>
          <p className="mt-2 text-sm leading-6 text-console-muted">Review current invoices, due dates and payment status.</p>
          <ActionLink href={routes.client.invoices} variant="outline" className="mt-5 w-full sm:w-auto">
            View invoices <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4"/>
          </ActionLink>
        </Panel>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
