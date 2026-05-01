import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Create Order" description="Create a clean record that will later sync with the backend API." />
      <ResourceEditor title="Create Order" subtitle="Frontend-ready form. Backend persistence comes in the Django integration phase." backHref="/admin/orders" fields={[{ label: "Customer", placeholder: "Enter customer" }, { label: "Product", placeholder: "Enter product" }, { label: "Plan", placeholder: "Enter plan" }, { label: "Billing Cycle", placeholder: "Enter billing cycle" }, { label: "Domain", placeholder: "Enter domain" }, { label: "Order Status", placeholder: "Enter order status" }]} />
    </main>
  );
}
