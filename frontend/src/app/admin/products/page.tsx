import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { products } from "@/lib/platform-data";

export default function Page() {
  const rows = products.map((row: any) => ({ ...row, href: `/admin/products/${row.id || row.name}`, editHref: `/admin/products/${row.id || row.name}` }));
  return (
    <main className="page-container">
      <PageHeader title="Products" description="Define service products and connect them to provider adapters." actions={<Button href="/admin/products/new">+ Add Product</Button>} />
      <DataTable title="Products" columns={[{ header: "Product ID", accessor: "id" }, { header: "Name", accessor: "name" }, { header: "Category", accessor: "category" }, { header: "Adapter", accessor: "adapter" }, { header: "Status", accessor: "status" }]} rows={rows} />
    </main>
  );
}
