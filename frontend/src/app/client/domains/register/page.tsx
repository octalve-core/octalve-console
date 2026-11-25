import Link from "next/link";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {ClientDomainSearch} from "@/features/client/components/ClientDomainSearch";

export default function ClientDomainRegistrationPage(){
  return <DashboardShell role="client" title="Register a domain"
    description="Search your perfect domain and review available registration extensions.">
    <DashboardPage eyebrow="Domains" title="Register New Domain"
      description="Search for your domain and view published registration prices.">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-5 text-sm font-medium text-console-primary">
          <Link href="/client/domains">My domains</Link>
          <Link href="/client/order/checkout?view=cart">View cart</Link>
        </div>
        <ClientDomainSearch discovery/>
        <p className="text-xs text-console-muted">A quote doesn’t reserve the domain.</p>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
