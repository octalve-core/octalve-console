import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { invoices } from "@/lib/platform-data";

export default function Page() {
  const rows = invoices.map((row: any) => ({ ...row, href: `/admin/billing/invoices/${row.id || row.domain || row.name}`, editHref: `/admin/billing/invoices/${row.id || row.domain || row.name}` }));
  return <main className="page-container"><PageHeader title="Invoices" description="Create, edit, void, pay and snapshot invoices for customers." actions={<Button href="/admin/billing/invoices/new">+ New</Button>} /><DataTable title="Invoices" columns={[{ header: "Invoice", accessor: "id" }, { header: "Client", accessor: "client" }, { header: "Total", accessor: "total" }, { header: "Paid", accessor: "paid" }, { header: "Due", accessor: "due" }, { header: "Status", accessor: "status" }]} rows={rows} /></main>;
}
