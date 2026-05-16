import type { ChangeEventHandler } from "react";

export type FormFieldProps = {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
  name?: string;
  as?: "input" | "select" | "textarea";
  options?: string[];
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
};

export function FormField({
  label,
  value,
  defaultValue,
  placeholder,
  type = "text",
  name,
  as = "input",
  options = [],
  rows = 4,
  required = false,
  disabled = false,
  helper,
  onChange,
}: FormFieldProps) {
  const commonProps = {
    name,
    placeholder,
    required,
    disabled,
    onChange,
    className: "input",
  };

  return (
    <label className="form-field">
      <span className="form-label">{label}</span>

      {as === "textarea" ? (
        <textarea
          {...commonProps}
          rows={rows}
          defaultValue={value ?? defaultValue ?? ""}
        />
      ) : as === "select" ? (
        <select
          {...commonProps}
          defaultValue={value ?? defaultValue ?? options[0] ?? ""}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...commonProps}
          type={type}
          defaultValue={value ?? defaultValue ?? ""}
        />
      )}

      {helper ? <span className="form-helper">{helper}</span> : null}
    </label>
  );
}
