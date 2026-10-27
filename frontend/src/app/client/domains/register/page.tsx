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
        <Link href="/client/domains" className="text-sm font-semibold text-console-primary">
          My Domains
        </Link>
        <ClientDomainSearch/>
        <p className="rounded-xl border border-console-line bg-white p-4 text-sm leading-6 text-console-muted">
          Registration is completed only after a registrar confirms availability,
          your final quote is approved, payment is verified and the registry acknowledges
          the registration. Published prices alone do not reserve a domain.
        </p>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
