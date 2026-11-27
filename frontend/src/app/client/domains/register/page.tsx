import {ClientPurchaseShortcuts} from "@/features/client/checkout/ClientPurchaseShortcuts";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {ClientDomainSearch} from "@/features/client/components/ClientDomainSearch";

export default function ClientDomainRegistrationPage(){
  return <DashboardShell role="client" title="Register a domain"
    description="Search your perfect domain and review available registration extensions.">
    <DashboardPage eyebrow="Domains" title="Register New Domain"
      description="Search for your domain and view published registration prices.">
      <div className="space-y-5">
        <ClientPurchaseShortcuts resource="domains"/>
        <ClientDomainSearch discovery/>
        <p className="text-xs text-console-muted">A quote doesn’t reserve the domain.</p>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
