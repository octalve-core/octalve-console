export type Primitive = string | number | boolean | null | undefined;

export type QueryParams = Record<string, Primitive>;

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  rawBody?: BodyInit | null;
  params?: QueryParams;
  token?: string | null;
  skipAuth?: boolean;
  timeoutMs?: number;
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

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const ACCESS_TOKEN_KEY = "octalve_console_access_token";
const REFRESH_TOKEN_KEY = "octalve_console_refresh_token";

function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function buildUrl(path: string, params?: QueryParams) {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(`${API_BASE_URL}/${path.replace(/^\/+/, "")}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function createHeaders(options: ApiRequestOptions) {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body !== undefined && !isFormData(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = options.token ?? getStoredAccessToken();

  if (!options.skipAuth && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : fallbackMessage;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    body,
    rawBody,
    params,
    timeoutMs = 30000,
    ...requestOptions
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = createHeaders(options);

  const requestBody =
    rawBody !== undefined
      ? rawBody
      : body === undefined
        ? undefined
        : isFormData(body)
          ? body
          : JSON.stringify(body);

  try {
    const response = await fetch(buildUrl(path, params), {
      ...requestOptions,
      headers,
      body: requestBody,
      signal: controller.signal,
      credentials: requestOptions.credentials || "include",
      cache: requestOptions.cache || "no-store"
    });

    return await parseResponse<T>(response);
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: "POST", body });
  },

  put<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: "PUT", body });
  },

  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: "PATCH", body });
  },

  del<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: "DELETE" });
  }
};

export const tokenStorage = {
  getAccessToken() {
    return getStoredAccessToken();
  },

  setTokens(accessToken: string, refreshToken?: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

    if (refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  clearTokens() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};
