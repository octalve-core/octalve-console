import { ApiError } from "./client";

export type ApiFieldErrors = Record<string, string[]>;

export type ParsedApiValidationError = {
  message: string;
  fieldErrors: ApiFieldErrors;
  raw?: unknown;
};

const GENERAL_ERROR_KEYS = new Set([
  "detail",
  "message",
  "error",
  "non_field_errors",
  "nonFieldErrors",
  "_form",
]);

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeFieldName(field: string) {
  const cleaned = field.trim();

  if (cleaned === "non_field_errors") return "_form";
  if (cleaned === "re_new_password") return "confirmPassword";
  if (cleaned === "re_password") return "confirmPassword";
  if (cleaned === "new_password") return "password";
  if (cleaned === "phone_number") return "phone";
  if (cleaned === "due_date") return "dueDate";
  if (cleaned === "auto_renew") return "autoRenew";
  if (cleaned === "base_url") return "baseUrl";
  if (cleaned === "adapter_type") return "adapterType";
  if (cleaned === "public_key") return "publicKey";
  if (cleaned === "secret_key") return "secretKey";
  if (cleaned === "webhook_secret") return "webhookSecret";
  if (cleaned === "payment_method") return "paymentMethod";
  if (cleaned === "plan_id") return "planId";

  return snakeToCamel(cleaned);
}

function stringifyErrorValue(value: unknown): string[] {
  if (value === undefined || value === null) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => stringifyErrorValue(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    try {
      return [JSON.stringify(value)];
    } catch {
      return ["Invalid value."];
    }
  }

  return [String(value).trim()].filter(Boolean);
}

function readPayload(error: unknown): unknown {
  if (error instanceof ApiError) return error.payload;

  if (error && typeof error === "object" && "payload" in error) {
    return (error as { payload?: unknown }).payload;
  }

  return undefined;
}

export function parseApiValidationError(
  error: unknown,
  fallback = "Unable to complete request. Please check the form and try again.",
): ParsedApiValidationError {
  const payload = readPayload(error);
  const fieldErrors: ApiFieldErrors = {};
  const generalMessages: string[] = [];

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const entries = Object.entries(payload as Record<string, unknown>);

    for (const [key, value] of entries) {
      const normalizedKey = normalizeFieldName(key);
      const messages = stringifyErrorValue(value);

      if (messages.length === 0) continue;

      if (GENERAL_ERROR_KEYS.has(key) || GENERAL_ERROR_KEYS.has(normalizedKey)) {
        generalMessages.push(...messages);
      } else {
        fieldErrors[normalizedKey] = [
          ...(fieldErrors[normalizedKey] ?? []),
          ...messages,
        ];
      }
    }
  }

  if (Array.isArray(payload)) {
    generalMessages.push(...stringifyErrorValue(payload));
  }

  if (typeof payload === "string") {
    generalMessages.push(payload);
  }

  if (error instanceof Error && generalMessages.length === 0) {
    generalMessages.push(error.message);
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return {
    message:
      generalMessages.find(Boolean) ??
      (hasFieldErrors ? "Please correct the highlighted fields." : fallback),
    fieldErrors,
    raw: payload,
  };
}

export function getApiFieldError(
  fieldErrors: ApiFieldErrors,
  field: string,
  aliases: string[] = [],
) {
  const keys = [
    field,
    normalizeFieldName(field),
    ...aliases,
    ...aliases.map(normalizeFieldName),
  ];

  for (const key of keys) {
    const value = fieldErrors[key];

    if (value?.length) return value.join(" ");
  }

  return undefined;
}

export function hasApiFieldErrors(fieldErrors: ApiFieldErrors) {
  return Object.keys(fieldErrors).length > 0;
}