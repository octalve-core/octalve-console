import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { services } from "@/lib/platform-data";

export default function Page() {
  const rows = services.map((row: any) => ({ ...row, href: `/admin/billing/services/${row.id || row.domain || row.name}`, editHref: `/admin/billing/services/${row.id || row.domain || row.name}` }));
  return <main className="page-container"><PageHeader title="Services" description="Manage customer services and provider-sync lifecycle." actions={<Button href="/admin/billing/services/new">+ New</Button>} /><DataTable title="Services" columns={[{ header: "Service", accessor: "id" }, { header: "Customer", accessor: "customer" }, { header: "Package", accessor: "package" }, { header: "Label", accessor: "label" }, { header: "Term", accessor: "term" }, { header: "Status", accessor: "status" }]} rows={rows} /></main>;
}
