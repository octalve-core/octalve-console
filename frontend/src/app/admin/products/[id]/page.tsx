import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Manage Products" description="Edit, sync and manage this record. Actions are prepared for API integration." />
      <ResourceEditor title="Edit Products" subtitle="Use this page for admin create/edit/performance operations." backHref="/admin/products" fields={[{ label: "Product Name", placeholder: "Enter product name" }, { label: "Category", placeholder: "Enter category" }, { label: "Adapter", placeholder: "Enter adapter" }, { label: "Status", placeholder: "Enter status" }, { label: "Description", placeholder: "Enter description" }, { label: "Sort Order", placeholder: "Enter sort order" }]} />
    </main>
  );
}
