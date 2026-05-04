import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { RichTextEditor } from "@/components/modules/RichTextEditor";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader
        title="Create Knowledge Base Article"
        description="Create a customer or staff help article for hosting, domains, billing, migration, support or security."
        actions={
          <>
            <Button href="/admin/knowledge-base" variant="secondary">Back</Button>
            <Button>Create Article</Button>
          </>
        }
      />

      <Card padded>
        <div className="form-grid">
          <FormField label="Title" placeholder="How to point your domain to Octalve Cloud" />
          <FormField label="Category" placeholder="Domain" />
          <FormField label="Status" as="select" options={["Draft", "Published", "Unpublished"]} value="Draft" />
          <FormField label="Visibility" as="select" options={["Client", "Staff", "Public", "Internal"]} value="Client" />
          <FormField label="Excerpt" as="textarea" placeholder="Short article summary" />
        </div>

        <div style={{ marginTop: 18 }}>
          <RichTextEditor
            label="Article Content"
            initialValue="<h2>Article heading</h2><p>Write the full help article here.</p>"
          />
        </div>

        <div className="page-actions" style={{ marginTop: 18 }}>
          <Button>Create Article</Button>
        </div>
      </Card>
    </main>
  );
}
