import { ResourceEditor } from "@/components/modules/ResourceEditor";

export default function Page() {
  return (
    <main className="page-container">
      <ResourceEditor
        title="Create Notification Template"
        subtitle="Create an official email/system notification template for Octalve Console automation."
        backHref="/admin/settings/notifications"
        submitLabel="Create Template"
        fields={[
          { label: "Subject", placeholder: "New invoice created" },
          { label: "Trigger Event", placeholder: "invoice.created" },
          { label: "Recipient", as: "select", options: ["Client", "Admin", "Staff", "User", "Client/Admin"], value: "Client" },
          { label: "Enabled", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" },
          { label: "HTML Body", as: "textarea", placeholder: "<h1>Hello {{ user.name }}</h1>" },
          { label: "Plain Text Body", as: "textarea", placeholder: "Hello {{ user.name }}" }
        ]}
      />
    </main>
  );
}
