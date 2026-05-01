import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { orders } from "@/lib/platform-data";

export default function Page() {
  const rows = orders.map((row: any) => ({ ...row, href: `/admin/orders/${row.id || row.name}`, editHref: `/admin/orders/${row.id || row.name}` }));
  return (
    <main className="page-container">
      <PageHeader title="Orders" description="Track new orders, review payment status and queue automation after invoice payment." actions={<Button href="/admin/orders/new">+ Create Order</Button>} />
      <DataTable title="Orders" columns={[{ header: "Order", accessor: "id" }, { header: "Customer", accessor: "customer" }, { header: "Product", accessor: "product" }, { header: "Total", accessor: "total" }, { header: "Status", accessor: "status" }]} rows={rows} />
    </main>
  );
}
