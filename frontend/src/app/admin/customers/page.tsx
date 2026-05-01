import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { customers } from "@/lib/platform-data";

export default function Page() {
  const rows = customers.map((row: any) => ({ ...row, href: `/admin/customers/${row.id || row.name}`, editHref: `/admin/customers/${row.id || row.name}` }));
  return (
    <main className="page-container">
      <PageHeader title="Customers" description="Manage client accounts, contacts, services, invoices, wallet balance, tickets and security notes." actions={<Button href="/admin/customers/new">+ Add Customer</Button>} />
      <DataTable title="Customers" columns={[{ header: "Client ID", accessor: "id" }, { header: "Name", accessor: "name" }, { header: "Email", accessor: "email" }, { header: "Phone", accessor: "phone" }, { header: "Services", accessor: "services" }, { header: "Status", accessor: "status" }]} rows={rows} />
    </main>
  );
}
