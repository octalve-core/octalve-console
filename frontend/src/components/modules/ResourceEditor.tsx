import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";

export function ResourceEditor({ title, subtitle, fields, backHref = "/admin" }: { title: string; subtitle?: string; fields: Array<{ label: string; value?: string; type?: string; as?: "input" | "textarea" | "select"; options?: string[] }>; backHref?: string }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        <form className="grid">
          <div className="form-grid">
            {fields.map((field) => <FormField key={field.label} {...field} />)}
          </div>
          <div className="page-actions" style={{ marginTop: 10 }}>
            <Button href={backHref} variant="secondary">Cancel</Button>
            <Button>Save changes</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
