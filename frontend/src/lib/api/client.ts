export type Primitive = string | number | boolean | null | undefined;
import {privateQueryClear,privateQueryGeneration} from "./private-query-cache";

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

type HttpVerb = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Concurrent identical reads share one network request, never a cached response.
 * Authenticated BFF cookies remain server-managed. Epochs isolate login/logout,
 * rejected sessions and mutations, and no response persists across navigation.
 */
const pendingReads = new Map<string,{generation:number;promise:Promise<unknown>}>();
const MAX_PENDING_READS = 60;

async function performRequest<T>(
  method: HttpVerb,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
  expectedGeneration?: number,
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
    // Bound read-only requests so a stalled service cannot leave screens loading forever.
    // Do not auto-retry writes or timeout an ambiguous order/payment mutation.
    signal: method === "GET" ? AbortSignal.timeout(27000) : undefined,
  });

  const payload = await parseResponse(response);

  // A response from before logout, role switch or a successful write must not
  // be delivered into a new account's UI or overwrite newer financial state.
  if(method==="GET"&&expectedGeneration!==undefined&&
     privateQueryGeneration()!==expectedGeneration){
    throw new ApiError("This information changed. Please refresh your view.",409);
  }

  if (!response.ok) {
    // A rejected session or role check must never leave reusable private
    // display records in the query cache. Only Django can authorize access.
    if(response.status===401||response.status===403)privateQueryClear();
    throw new ApiError(
      getErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  // Any accepted mutation invalidates cached display rows. No cache value
  // can authorize a financial or role-changing operation.
  if(method!=="GET")privateQueryClear();
  return payload as T;
}

async function request<T>(
  method: HttpVerb,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  // Only ordinary browser GETs without custom headers may join. Never share
  // writes, token endpoints, custom-auth requests or server-rendered requests.
  if(method!=="GET"||!isBrowser()||options.skipAuth||options.headers){
    const epoch=method==="GET"&&isBrowser()&&!options.skipAuth
      ?privateQueryGeneration():undefined;
    return performRequest<T>(method,path,body,options,epoch);
  }
  const key=createUrl(path,options.params);
  const generation=privateQueryGeneration();
  const pending=pendingReads.get(key);
  if(pending&&pending.generation===generation)return pending.promise as Promise<T>;
  // Bound in-flight memory even if many distinct filter URLs are requested.
  if(pendingReads.size>=MAX_PENDING_READS){
    return performRequest<T>(method,path,body,options,generation);
  }
  const promise=performRequest<T>(method,path,body,options,generation);
  pendingReads.set(key,{generation,promise});
  try{return await promise;}
  finally{
    if(pendingReads.get(key)?.promise===promise)pendingReads.delete(key);
  }
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