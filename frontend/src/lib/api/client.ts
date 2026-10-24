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
  "password",
  "new_password",
  "re_new_password",
  "re_password",
  "token",
  "access",
  "refresh",
  "secret",
  "secret_key",
  "api_key",
]);

function isBrowser() {
  return typeof window !== "undefined";
}

function getStorage() {
  if (!isBrowser()) return null;
  return window.sessionStorage;
}

function removeLegacyLocalStorageTokens() {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem("octalve_console_demo_user");
  } catch {
    // Ignore browser storage errors.
  }
}

export const tokenStorage = {
  getAccessToken() {
    removeLegacyLocalStorageTokens();
    return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
  },

  getRefreshToken() {
    removeLegacyLocalStorageTokens();
    return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
  },

  setTokens(access?: string | null, refresh?: string | null) {
    const storage = getStorage();
    if (!storage) return;

    removeLegacyLocalStorageTokens();

    if (access) {
      storage.setItem(ACCESS_TOKEN_KEY, access);
    } else {
      storage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (refresh) {
      storage.setItem(REFRESH_TOKEN_KEY, refresh);
    } else {
      storage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  clearTokens() {
    const storage = getStorage();

    if (storage) {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
    }

    removeLegacyLocalStorageTokens();
  },
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

  const isAbsolute = /^https?:\/\//i.test(path);
  const base = API_BASE_URL.trim().replace(/\/$/, "");
  if (!isAbsolute) {
    // Never silently use a relative Console path, a stale Review bridge, or
    // an assumed Production API when the deployment lacks explicit config.
    let configured: URL;
    try {
      configured = new URL(base);
    } catch {
      throw new Error("Octalve Cloud API URL is not configured for this deployment.");
    }
    if (
      !["https:", "http:"].includes(configured.protocol) ||
      (configured.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(configured.hostname)) ||
      configured.pathname.replace(/\/$/, "") !== "/api" ||
      configured.search ||
      configured.hash ||
      configured.username ||
      configured.password
    ) {
      throw new Error("Octalve Cloud API URL must be an HTTPS origin ending in /api.");
    }
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(isAbsolute ? path : `${base}${cleanPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            url.searchParams.append(key, String(item));
          }
        }
      } else if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return isAbsolute || base ? url.toString() : `${cleanPath}${url.search}`;
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

  if (!options.skipAuth) {
    const accessToken = tokenStorage.getAccessToken();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(createUrl(path, options.params), {
    method,
    headers,
    body:
      method === "GET" || method === "DELETE"
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body ?? {}),
    credentials: "include",
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