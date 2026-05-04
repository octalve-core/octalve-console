import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { getNotificationTemplate } from "@/lib/notification-templates";

export default function Page({ params }: { params: { id: string } }) {
  const template = getNotificationTemplate(params.id);

  return (
    <main className="page-container">
      <PageHeader
        title={template.subject}
        description={template.description}
        actions={
          <>
            <Button href="/admin/settings/notifications" variant="secondary">Back</Button>
            <Button variant="secondary">Send Test Email</Button>
            <Button>Save Template</Button>
          </>
        }
      />

      <div className="grid cols-2">
        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Template Configuration</p>
              <h2>Email Template</h2>
            </div>
          </div>

          <div className="form-grid">
            <FormField label="Subject" value={template.subject} />
            <FormField label="Trigger Event" value={template.trigger} />
            <FormField label="Recipient" value={template.recipient} />
            <FormField label="Enabled" as="select" options={["Enabled", "Disabled"]} value={template.enabled ? "Enabled" : "Disabled"} />
            <FormField label="HTML Body" as="textarea" value={template.htmlBody} />
            <FormField label="Plain Text Body" as="textarea" value={template.textBody} />
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Variables</p>
              <h2>Available Merge Tags</h2>
              <p>These variables should be replaced by the backend notification engine when sending the template.</p>
            </div>
          </div>

          <div className="template-variable-grid">
            {template.variables.map((variable) => (
              <code key={variable}>{variable}</code>
            ))}
          </div>

          <div className="notice" style={{ marginTop: 20 }}>
            Backend should render this template after events such as invoice creation, payment confirmation, service activation and support replies.
          </div>
        </Card>
      </div>
    </main>
  );
}
