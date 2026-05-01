import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { domains } from "@/lib/platform-data";

export default function Page() {
  const rows = domains.map((row: any) => ({ ...row, href: `/admin/billing/domains/${row.id || row.domain || row.name}`, editHref: `/admin/billing/domains/${row.id || row.domain || row.name}` }));
  return <main className="page-container"><PageHeader title="Domains" description="Domain registrations, transfers, renewals, nameservers and registrar sync." actions={<Button href="/admin/billing/domains/new">+ New</Button>} /><DataTable title="Domains" columns={[{ header: "Domain ID", accessor: "id" }, { header: "Domain", accessor: "domain" }, { header: "Client", accessor: "client" }, { header: "Registrar", accessor: "registrar" }, { header: "Renewal", accessor: "renewal" }, { header: "Status", accessor: "status" }]} rows={rows} /></main>;
}
