type FieldProps = {
  label: string;
  placeholder?: string;
  type?: string;
  value?: string;
  as?: "input" | "textarea" | "select";
  options?: string[];
};

export function FormField({ label, placeholder, type = "text", value, as = "input", options = [] }: FieldProps) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      {as === "textarea" ? (
        <textarea className="textarea" placeholder={placeholder} defaultValue={value} />
      ) : as === "select" ? (
        <select className="select" defaultValue={value || options[0] || ""}>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <input className="input" type={type} placeholder={placeholder} defaultValue={value} />
      )}
    </label>
  );
}
