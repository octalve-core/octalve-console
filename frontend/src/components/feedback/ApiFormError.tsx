import { AlertCircle } from "lucide-react";
import type { ApiFieldErrors } from "@/lib/api/validation";

type ApiFormErrorProps = {
  message?: string;
  fieldErrors?: ApiFieldErrors;
};

export function ApiFormError({ message, fieldErrors = {} }: ApiFormErrorProps) {
  const entries = Object.entries(fieldErrors);

  if (!message && entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          {message ? <p className="font-medium">{message}</p> : null}

          {entries.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1">
              {entries.map(([field, errors]) => (
                <li key={field}>
                  <span className="font-medium">{field}:</span> {errors.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}