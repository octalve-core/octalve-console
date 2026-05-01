import { PageHeader } from "@/components/layout/PageHeader";
import { ServiceManagement } from "@/components/modules/ServiceManagement";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <main className="page-container">
      <PageHeader title="Admin Service Management" description="Manage service lifecycle, provider sync, DNS, usage, hosting tools, VPS actions, backup and migration operations." />
      <ServiceManagement id={params.id} />
    </main>
  );
}
