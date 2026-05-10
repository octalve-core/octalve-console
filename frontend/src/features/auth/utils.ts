import { ApiError } from "@/lib/api/client";

function stringifyErrorValue(value: unknown) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "An unexpected error occurred.";
    }
  }

  return String(value);
}

export function getAuthErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ApiError) {
    const payload = error.payload as Record<string, unknown> | undefined;

    if (payload) {
      const priorityKeys = [
        "detail",
        "message",
        "non_field_errors",
        "email",
        "password",
        "new_password",
        "re_new_password",
        "uid",
        "token",
        "full_name",
      ];

      for (const key of priorityKeys) {
        const value = payload[key];

        if (value) {
          return stringifyErrorValue(value);
        }
      }
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function decodeResetValue(value: string) {
  if (!value) return "";

  let decoded = value;

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep original value if decoding fails.
  }

  decoded = decoded.replace(/%3D/gi, "=");

  while (decoded.includes("%")) {
    try {
      const previous = decoded;
      decoded = decodeURIComponent(decoded);

      if (previous === decoded) break;
    } catch {
      break;
    }
  }

  return decoded.trim();
}
