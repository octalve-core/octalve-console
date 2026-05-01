import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { tickets } from "@/lib/platform-data";

export default function Page() {
  const rows = tickets.map((r) => ({ ...r, href: `/client/support/${r.id}` }));
  return (
    <main className="page-container">
      <PageHeader title="Support" description="Create and track support, DNS, migration and billing tickets." actions={<Button href="/client/support/new">Open Ticket</Button>} />
      <DataTable title="My Tickets" columns={[{ header: "Ticket", accessor: "id" }, { header: "Subject", accessor: "subject" }, { header: "Department", accessor: "department" }, { header: "Priority", accessor: "priority" }, { header: "Status", accessor: "status" }]} rows={rows} />
    </main>
  );
}
