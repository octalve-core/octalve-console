import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { notificationTemplates } from "@/lib/notification-templates";

const rows = notificationTemplates.map((template) => ({
  id: template.id,
  subject: template.subject,
  trigger: template.trigger,
  recipient: template.recipient,
  status: template.enabled ? "Enabled" : "Disabled",
  href: `/admin/settings/notifications/${template.id}`,
  editHref: `/admin/settings/notifications/${template.id}`
}));

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader
        title="Notification Templates"
        description="Email and system notification templates for customers, staff, admins and automation events."
        actions={<Button href="/admin/settings/notifications/new">+ New Template</Button>}
      />

      <DataTable
        title="Templates"
        columns={[
          { header: "Subject", accessor: "subject" },
          { header: "Trigger", accessor: "trigger" },
          { header: "Recipient", accessor: "recipient" },
          { header: "Enabled", accessor: "status" }
        ]}
        rows={rows}
      />
    </main>
  );
}
