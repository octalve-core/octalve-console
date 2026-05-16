import { ApiError } from "./client";

export type ListResponse<T> = T[] | {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
};

export function unwrapListResponse<T>(response: ListResponse<T> | unknown): T[] {
  const value = response as ListResponse<T>;

  if (Array.isArray(value)) return value;

  if (value && typeof value === "object" && Array.isArray(value.results)) {
    return value.results;
  }

  return [];
}

export function getListResponseCount<T>(response: ListResponse<T> | unknown) {
  const value = response as ListResponse<T>;

  if (Array.isArray(value)) return value.length;

  if (value && typeof value === "object") {
    if (typeof value.count === "number") return value.count;
    if (Array.isArray(value.results)) return value.results.length;
  }

  return 0;
}

function stringifyApiValue(value: unknown) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Unexpected API error.";
    }
  }

  return String(value);
}

export function getApiErrorMessage(error: unknown, fallback = "Unable to complete request. Please try again.") {
  if (error instanceof ApiError) {
    const payload = error.payload as Record<string, unknown> | undefined;

    if (payload) {
      const priorityKeys = [
        "detail",
        "message",
        "error",
        "non_field_errors",
        "email",
        "password",
        "uid",
        "token",
        "status",
      ];

      for (const key of priorityKeys) {
        const value = payload[key];

        if (value) {
          return stringifyApiValue(value);
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