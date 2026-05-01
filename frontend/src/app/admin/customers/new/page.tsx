import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Add Customer" description="Create a clean record that will later sync with the backend API." />
      <ResourceEditor title="Add Customer" subtitle="Frontend-ready form. Backend persistence comes in the Django integration phase." backHref="/admin/customers" fields={[{ label: "Full Name", placeholder: "Enter full name" }, { label: "Email Address", placeholder: "Enter email address" }, { label: "Phone Number", placeholder: "Enter phone number" }, { label: "Company Name", placeholder: "Enter company name" }, { label: "Client Group", placeholder: "Enter client group" }, { label: "Status", placeholder: "Enter status" }]} />
    </main>
  );
}
