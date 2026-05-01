import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Add Product" description="Create a clean record that will later sync with the backend API." />
      <ResourceEditor title="Add Product" subtitle="Frontend-ready form. Backend persistence comes in the Django integration phase." backHref="/admin/products" fields={[{ label: "Product Name", placeholder: "Enter product name" }, { label: "Category", placeholder: "Enter category" }, { label: "Adapter", placeholder: "Enter adapter" }, { label: "Status", placeholder: "Enter status" }, { label: "Description", placeholder: "Enter description" }, { label: "Sort Order", placeholder: "Enter sort order" }]} />
    </main>
  );
}
