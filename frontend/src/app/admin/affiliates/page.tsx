import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { customers } from "@/lib/platform-data";

export default function Page() {
  const rows = customers.map((row: any) => ({ ...row, href: `/admin/affiliates/${row.id || row.name}`, editHref: `/admin/affiliates/${row.id || row.name}` }));
  return (
    <main className="page-container">
      <PageHeader title="Affiliates" description="Prepare referral tracking, affiliate commissions and payout rules for future growth." actions={<Button href="/admin/affiliates/new">+ Add Affiliate</Button>} />
      <DataTable title="Affiliates" columns={[{ header: "Client ID", accessor: "id" }, { header: "Name", accessor: "name" }, { header: "Email", accessor: "email" }, { header: "Status", accessor: "status" }]} rows={rows} />
    </main>
  );
}
