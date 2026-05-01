import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Add Affiliate" description="Create a clean record that will later sync with the backend API." />
      <ResourceEditor title="Add Affiliate" subtitle="Frontend-ready form. Backend persistence comes in the Django integration phase." backHref="/admin/affiliates" fields={[{ label: "Affiliate Name", placeholder: "Enter affiliate name" }, { label: "Commission Type", placeholder: "Enter commission type" }, { label: "Commission Rate", placeholder: "Enter commission rate" }, { label: "Payout Method", placeholder: "Enter payout method" }, { label: "Status", placeholder: "Enter status" }]} />
    </main>
  );
}
