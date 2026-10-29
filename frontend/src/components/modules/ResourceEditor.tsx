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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-console-ink">{title}</h2>
          {supportingText ? <p className="mt-1 text-[13px] leading-5 text-console-muted">{supportingText}</p> : null}
        </div>

        {backHref ? (
          <Button href={backHref} variant="secondary">
            Back
          </Button>
        ) : null}
      </div>

      <form className="space-y-4" onSubmit={event=>event.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <FormField
              key={`${field.label}-${field.name ?? field.placeholder ?? field.value ?? ""}`}
              {...field}
            />
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {secondaryActionHref && secondaryActionLabel ? (
            <Button href={secondaryActionHref} variant="secondary">
              {secondaryActionLabel}
            </Button>
          ) : null}

          <Button type="button" disabled title="This editor must be connected to its authorized service before saving">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}
