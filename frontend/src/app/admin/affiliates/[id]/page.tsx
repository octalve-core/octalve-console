import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Manage Affiliates" description="Edit, sync and manage this record. Actions are prepared for API integration." />
      <ResourceEditor title="Edit Affiliates" subtitle="Use this page for admin create/edit/performance operations." backHref="/admin/affiliates" fields={[{ label: "Affiliate Name", placeholder: "Enter affiliate name" }, { label: "Commission Type", placeholder: "Enter commission type" }, { label: "Commission Rate", placeholder: "Enter commission rate" }, { label: "Payout Method", placeholder: "Enter payout method" }, { label: "Status", placeholder: "Enter status" }]} />
    </main>
  );
}
