import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Manage Orders" description="Edit, sync and manage this record. Actions are prepared for API integration." />
      <ResourceEditor title="Edit Orders" subtitle="Use this page for admin create/edit/performance operations." backHref="/admin/orders" fields={[{ label: "Customer", placeholder: "Enter customer" }, { label: "Product", placeholder: "Enter product" }, { label: "Plan", placeholder: "Enter plan" }, { label: "Billing Cycle", placeholder: "Enter billing cycle" }, { label: "Domain", placeholder: "Enter domain" }, { label: "Order Status", placeholder: "Enter order status" }]} />
    </main>
  );
}
