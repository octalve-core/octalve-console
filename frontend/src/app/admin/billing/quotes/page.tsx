import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { invoices } from "@/lib/platform-data";

export default function Page() {
  const rows = invoices.map((row: any) => ({ ...row, href: `/admin/billing/quotes/${row.id || row.domain || row.name}`, editHref: `/admin/billing/quotes/${row.id || row.domain || row.name}` }));
  return <main className="page-container"><PageHeader title="Quotes" description="Future invoices and pre-invoice estimates that can convert into real invoices." actions={<Button href="/admin/billing/quotes/new">+ New</Button>} /><DataTable title="Quotes" columns={[{ header: "Quote", accessor: "id" }, { header: "Client", accessor: "client" }, { header: "Total", accessor: "total" }, { header: "Date", accessor: "date" }, { header: "Status", accessor: "status" }]} rows={rows} /></main>;
}
