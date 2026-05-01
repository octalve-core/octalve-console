import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { transactions } from "@/lib/platform-data";

export default function Page() {
  const rows = transactions.map((row: any) => ({ ...row, href: `/admin/billing/transactions/${row.id || row.domain || row.name}`, editHref: `/admin/billing/transactions/${row.id || row.domain || row.name}` }));
  return <main className="page-container"><PageHeader title="Transactions" description="Approved, declined, voided, refunded and applied payments." actions={<Button href="/admin/billing/transactions/new">+ New</Button>} /><DataTable title="Transactions" columns={[{ header: "Transaction", accessor: "id" }, { header: "Client", accessor: "client" }, { header: "Type", accessor: "type" }, { header: "Amount", accessor: "amount" }, { header: "Applied", accessor: "applied" }, { header: "Status", accessor: "status" }]} rows={rows} /></main>;
}
