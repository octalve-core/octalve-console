import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Manage Customers" description="Edit, sync and manage this record. Actions are prepared for API integration." />
      <ResourceEditor title="Edit Customers" subtitle="Use this page for admin create/edit/performance operations." backHref="/admin/customers" fields={[{ label: "Full Name", placeholder: "Enter full name" }, { label: "Email Address", placeholder: "Enter email address" }, { label: "Phone Number", placeholder: "Enter phone number" }, { label: "Company Name", placeholder: "Enter company name" }, { label: "Client Group", placeholder: "Enter client group" }, { label: "Status", placeholder: "Enter status" }]} />
    </main>
  );
}
