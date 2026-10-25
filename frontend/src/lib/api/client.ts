export type Primitive = string | number | boolean | null | undefined;

export type QueryParams = Record<string, Primitive | Primitive[]>;

export type ApiRequestOptions = {
  params?: QueryParams;
  skipAuth?: boolean;
  headers?: HeadersInit;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const ACCESS_TOKEN_KEY = "octalve_console_access_token";
const REFRESH_TOKEN_KEY = "octalve_console_refresh_token";
const SENSITIVE_QUERY_KEYS = new Set([
  "password", "new_password", "re_new_password", "re_password",
  "token", "access", "refresh", "secret", "secret_key", "api_key",
]);

function isBrowser() {
  return typeof window !== "undefined";
}

function purgeLegacyWebStorage() {
  if (!isBrowser()) return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem("octalve_console_demo_user");
    } catch {
      // Storage might be unavailable in a hardened browsing context.
    }
  }
}

/** Deprecated compatibility only. Never store or return session credentials. */
export const tokenStorage = {
  getAccessToken() { purgeLegacyWebStorage(); return null; },
  getRefreshToken() { purgeLegacyWebStorage(); return null; },
  setTokens() { throw new Error("Browser JWT storage is disabled."); },
  clearTokens() { purgeLegacyWebStorage(); },
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function assertSafeQueryParams(params?: QueryParams) {
  if (!params) return;

  for (const key of Object.keys(params)) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      throw new Error(`Blocked sensitive value in query parameter: ${key}`);
    }
  }
}

function createUrl(path: string, params?: QueryParams) {
  assertSafeQueryParams(params);
  purgeLegacyWebStorage();
  const backend = API_BASE_URL.trim().replace(/\/$/, "");
  let configured: URL;
  try {
    configured = new URL(backend);
  } catch {
    throw new Error("Octalve Cloud API URL is not configured.");
  }
  if (
    !(configured.protocol === "https:" ||
      (configured.protocol === "http:" &&
       ["localhost", "127.0.0.1"].includes(configured.hostname))) ||
    configured.pathname.replace(/\/$/, "") !== "/api" ||
    configured.username || configured.password ||
    configured.search || configured.hash
  ) {
    throw new Error("Octalve Cloud API URL must end in /api on a permitted origin.");
  }

  let cleanPath: string;
  if (/^https?:\/\//i.test(path)) {
    const supplied = new URL(path);
    if (supplied.origin !== configured.origin ||
        !supplied.pathname.startsWith("/api/") ||
        supplied.username || supplied.password) {
      throw new Error("Untrusted external API destination.");
    }
    cleanPath = supplied.pathname.slice(4) + supplied.search;
  } else {
    cleanPath = path.startsWith("/") ? path : `/${path}`;
  }

  // The browser only calls the same-origin BFF; it never sends Django JWTs.
  const dest = isBrowser()
    ? new URL(`/api/cloud${cleanPath}`, window.location.origin)
    : new URL(`${backend}${cleanPath}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            dest.searchParams.append(key, String(item));
          }
        }
      } else if (value !== undefined && value !== null) {
        dest.searchParams.set(key, String(value));
      }
    }
  }
  return isBrowser() ? dest.pathname + dest.search : dest.toString();
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 204) return null;

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload) return fallback;

  if (typeof payload === "string") return payload;

  if (typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;

    for (const key of ["detail", "message", "error", "non_field_errors"]) {
      const value = record[key];

      if (Array.isArray(value)) return value.join(" ");
      if (typeof value === "string") return value;
    }
  }

  return fallback;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  // Authentication lives in HttpOnly cookies; the BFF adds Authorization.

  const response = await fetch(createUrl(path, options.params), {
    method,
    headers,
    body:
      method === "GET" || method === "DELETE"
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body ?? {}),
    credentials: "same-origin",
    cache: "no-store",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export const api = {
  get<T>(path: string, options?: ApiRequestOptions) {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return request<T>("POST", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return request<T>("PATCH", path, body, options);
  },

  put<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return request<T>("PUT", path, body, options);
  },

  del<T>(path: string, options?: ApiRequestOptions) {
    return request<T>("DELETE", path, undefined, options);
  },
};