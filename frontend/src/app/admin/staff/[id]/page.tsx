import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Manage Staff" description="Edit, sync and manage this record. Actions are prepared for API integration." />
      <ResourceEditor title="Edit Staff" subtitle="Use this page for admin create/edit/performance operations." backHref="/admin/staff" fields={[{ label: "Full Name", placeholder: "Enter full name" }, { label: "Email", placeholder: "Enter email" }, { label: "Role", placeholder: "Enter role" }, { label: "Title", placeholder: "Enter title" }, { label: "Assigned Departments", placeholder: "Enter assigned departments" }, { label: "Receive Ticket Emails", placeholder: "Enter receive ticket emails" }, { label: "Status", placeholder: "Enter status" }]} />
    </main>
  );
}
