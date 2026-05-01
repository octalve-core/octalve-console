import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { customers } from "@/lib/platform-data";

export default function Page() {
  const rows = customers.map((row: any) => ({ ...row, href: `/admin/staff/${row.id || row.name}`, editHref: `/admin/staff/${row.id || row.name}` }));
  return (
    <main className="page-container">
      <PageHeader title="Staff" description="Manage staff members, roles, ticket notifications, schedules and department assignments." actions={<Button href="/admin/staff/new">+ Add Staff</Button>} />
      <DataTable title="Staff" columns={[{ header: "Staff ID", accessor: "id" }, { header: "Name", accessor: "name" }, { header: "Email", accessor: "email" }, { header: "Status", accessor: "status" }]} rows={rows} />
    </main>
  );
}
