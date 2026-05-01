import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Add Staff" description="Create a clean record that will later sync with the backend API." />
      <ResourceEditor title="Add Staff" subtitle="Frontend-ready form. Backend persistence comes in the Django integration phase." backHref="/admin/staff" fields={[{ label: "Full Name", placeholder: "Enter full name" }, { label: "Email", placeholder: "Enter email" }, { label: "Role", placeholder: "Enter role" }, { label: "Title", placeholder: "Enter title" }, { label: "Assigned Departments", placeholder: "Enter assigned departments" }, { label: "Receive Ticket Emails", placeholder: "Enter receive ticket emails" }, { label: "Status", placeholder: "Enter status" }]} />
    </main>
  );
}
