import { Card } from "@/components/ui/Card";
import { FormField, type FormFieldProps } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export type ResourceEditorField = FormFieldProps;

export type ResourceEditorProps = {
  title: string;
  subtitle?: string;
  description?: string;
  backHref?: string;
  fields: ResourceEditorField[];
  submitLabel?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
};

export function ResourceEditor({
  title,
  subtitle,
  description,
  backHref,
  fields,
  submitLabel = "Save",
  secondaryActionLabel,
  secondaryActionHref,
}: ResourceEditorProps) {
  const supportingText = subtitle ?? description;

  return (
    <Card padded>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {supportingText ? <p>{supportingText}</p> : null}
        </div>

        {backHref ? (
          <Button href={backHref} variant="secondary">
            Back
          </Button>
        ) : null}
      </div>

      <form className="stacked-form">
        <div className="form-grid">
          {fields.map((field) => (
            <FormField
              key={`${field.label}-${field.name ?? field.placeholder ?? field.value ?? ""}`}
              {...field}
            />
          ))}
        </div>

        <div className="page-actions">
          {secondaryActionHref && secondaryActionLabel ? (
            <Button href={secondaryActionHref} variant="secondary">
              {secondaryActionLabel}
            </Button>
          ) : null}

          <Button type="button">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}
