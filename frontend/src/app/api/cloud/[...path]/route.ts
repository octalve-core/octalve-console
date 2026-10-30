import { NextRequest, NextResponse } from "next/server";
import { canonicalCloudDjangoPath, cloudUpstreamUrl } from "@/lib/api/cloud-path";
import {
  SESSION_ACCESS_COOKIE,
  SESSION_REFRESH_COOKIE,
  clearSessionCookies,
  resolveCloudApiBase,
  sameOriginRequest,
  setSessionCookies,
  signedClientIpHeaders,
} from "@/lib/api/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };
type Tokens = { access?: unknown; refresh?: unknown; user?: unknown };

const MAX_REQUEST_BODY = 10 * 1024 * 1024;
const SECRET_QUERY_KEYS = new Set([
  "access", "refresh", "token", "password", "new_password",
  "re_new_password", "api_key", "secret", "secret_key",
]);
const API_ROOTS = new Set([
  "auth", "catalog", "orders", "billing", "providers", "payments",
  "services", "provisioning", "domains", "support", "audit", "settings",
  "reports", "wallet", "dashboard", "knowledge-base", "integrations",
  "storefront", "notifications", "rewards",
]);
const ALLOWED_AUTH_PATHS = new Set([
  "auth/jwt/create", "auth/register", "auth/username-availability", "auth/logout",
  "auth/users/me", "auth/me",
  "auth/users/reset_password", "auth/users/reset_password_confirm",
  "auth/users/set_password", "auth/customers",
"auth/profile", "auth/language", "auth/staff", "auth/email/verification/request", "auth/email/verification/confirm",
]);

function error(status: number, detail: string) {
  return NextResponse.json(
    { detail }, { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function takeString(value: unknown) {
  return typeof value === "string" && value.length > 10 && value.length < 8192
    ? value
    : null;
}

async function readPayload(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_REQUEST_BODY) return null;
  const body = await request.arrayBuffer();
  return body.byteLength <= MAX_REQUEST_BODY ? body : null;
}

async function upstreamFetch(
  url: string,
  method: string,
  authorization?: string | null,
  body?: ArrayBuffer | string,
  contentType?: string | null,
  trustedHeaders: Record<string, string> = {},
) {
  const headers = new Headers({ Accept: "application/json" });
  if (authorization) headers.set("Authorization", `Bearer ${authorization}`);
  if (contentType) headers.set("Content-Type", contentType);
  for (const [key, value] of Object.entries(trustedHeaders)) headers.set(key, value);
  return fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
}

async function rotatedToken(base: string, refresh: string | null, request: NextRequest) {
  if (!refresh) return null;
  try {
    const r = await upstreamFetch(
      `${base}/auth/jwt/refresh/`, "POST", null,
      JSON.stringify({ refresh }),
      "application/json",
      signedClientIpHeaders(request, "POST", "/api/auth/jwt/refresh/"),
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Tokens;
    const access = takeString(data.access);
    if (!access) return null;
    return { access, refresh: takeString(data.refresh) || refresh };
  } catch {
    return null;
  }
}

async function forward(request: NextRequest, context: Context) {
  const base = resolveCloudApiBase();
  if (!base) return error(503, "Cloud API is not configured.");
  const { path } = await context.params;
  if (!Array.isArray(path) || !path.length ||
      path.some((part) => !part || part === "." || part === ".." ||
        part.includes("/") || part.includes("\\") ||
        part.length > 160) ||
      !API_ROOTS.has(path[0])) {
    return error(404, "API route not found.");
  }
  for (const key of request.nextUrl.searchParams.keys()) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
      return error(400, "Sensitive query parameters are not allowed.");
    }
  }

  const method = request.method;
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return error(405, "Method not allowed.");
  }
  if (method !== "GET" &&
      !sameOriginRequest(
        request.headers.get("origin") || "",
        request.headers.get("sec-fetch-site"),
        request.nextUrl.origin,
      )) {
    return error(403, "Forbidden request origin.");
  }

  const apiPath = path.map(encodeURIComponent).join("/");
  // Next.js may strip a trailing slash from /api/cloud/... while Django's
  // APPEND_SLASH redirects its slashless endpoints. Preserve redirect: "manual"
  // and always target Django's canonical path instead of following a 301.
  const djangoPath = canonicalCloudDjangoPath(path);
  // base already ends in "/api", so never append "/api" a second time.
  const target = cloudUpstreamUrl(base, djangoPath, request.nextUrl.search);
  const trustedHeaders = signedClientIpHeaders(request, method, djangoPath);
  if (path[0] === "auth" &&
      !ALLOWED_AUTH_PATHS.has(apiPath) &&
      !(path[1] === "customers" && path.length === 3 && /^\d+$/.test(path[2]))) {
    return error(404, "API route not found.");
  }
  // Staff roster is explicitly GET-only; never proxy invitations, role edits or secrets.
  if (apiPath === "auth/staff" && method !== "GET") {
    return error(405, "Method not allowed.");
  }
  // Owner-only preference: never expose other auth verbs via the BFF.
  if (apiPath === "auth/language" && method !== "GET" && method !== "PATCH") {
    return error(405, "Method not allowed.");
  }
  // Only Console-authenticated issuance is browser-reachable. The confidential
  // code exchange and entitlement endpoints are server-to-server exclusively.
  // The sidebar may read only the published, sanitized category index.
  if (path[0] === "storefront" &&
      !(apiPath === "storefront/categories" && method === "GET")) {
    return error(404, "API route not found.");
  }
  if (path[0] === "integrations" &&
      !(apiPath === "integrations/opanel/v1/authorize" && method === "POST")) {
    return error(404, "API route not found.");
  }
  const isLogin = apiPath === "auth/jwt/create";
  const isRegistration = apiPath === "auth/register";
  const isLogout = apiPath === "auth/logout";
  const isDirectRefresh = apiPath === "auth/jwt/refresh" ||
    apiPath === "auth/jwt/verify";
  if (isDirectRefresh) return error(404, "Token endpoints are server-only.");

  const access = request.cookies.get(SESSION_ACCESS_COOKIE)?.value || null;
  const refresh = request.cookies.get(SESSION_REFRESH_COOKIE)?.value || null;
  const incomingBody = method === "GET" ? undefined : await readPayload(request);
  if (method !== "GET" && incomingBody === null) {
    return error(413, "Request body exceeds the maximum size.");
  }
  const contentType = request.headers.get("content-type");
  const body = incomingBody || undefined;

  if (isLogout) {
    let revoked = !refresh;
    if (refresh) {
      try {
        // Revocation requires an authenticated user. If the access JWT has
        // expired, rotate the refresh first, then revoke the new refresh.
        let token = access;
        let revokeRefresh = refresh;
        if (!token) {
          const rotated = await rotatedToken(base, refresh, request);
          token = rotated?.access || null;
          revokeRefresh = rotated?.refresh || refresh;
        }
        if (token) {
          let res = await upstreamFetch(
            target, "POST", token,
            JSON.stringify({ refresh: revokeRefresh }),
            "application/json",
            trustedHeaders,
          );
          if (res.status === 401 && refresh) {
            const rotated = await rotatedToken(base, refresh, request);
            if (rotated) {
              res = await upstreamFetch(
                target, "POST", rotated.access,
                JSON.stringify({ refresh: rotated.refresh }),
                "application/json",
                trustedHeaders,
              );
            }
          }
          revoked = res.ok;
        }
      } catch { revoked = false; }
    }
    const response = NextResponse.json(
      { ok: revoked },
      {
        status: revoked ? 200 : 502,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
    clearSessionCookies(response);
    return response;
  }

  try {
    const credentialExchange = method === "POST" && (isLogin || isRegistration);
    const first = await upstreamFetch(
      target, method, credentialExchange ? null : access,
      body, contentType, trustedHeaders,
    );

    if (credentialExchange) {
      if (!first.ok) return safeForward(first);
      const payload = (await first.json()) as Tokens;
      const token = takeString(payload.access);
      const newRefresh = takeString(payload.refresh);
      if (!token || !newRefresh) {
        return error(502, "Authentication token exchange failed.");
      }
      // Backend-authoritative identity and role, not a self-declared client role.
      const me = await upstreamFetch(`${base}/auth/users/me/`, "GET", token);
      if (!me.ok) return error(502, "Unable to verify authenticated identity.");
      const user = await me.json();
      const response = NextResponse.json(
        { user },
        { status: first.status, headers: { "Cache-Control": "private, no-store" } },
      );
      setSessionCookies(response, token, newRefresh);
      return response;
    }

    let final = first;
    let rotated: {access: string; refresh: string} | null = null;
    if (first.status === 401 && refresh && !isLogin && !isRegistration) {
      rotated = await rotatedToken(base, refresh, request);
      if (rotated) {
        final = await upstreamFetch(
          target, method, rotated.access, body, contentType, trustedHeaders,
        );
      }
    }
    const response = safeForward(final);
    if (rotated) {
      // A legitimate API-level 403 (insufficient role) must NOT log out the
      // user. Only a second 401 proves the refreshed identity was rejected.
      if (final.status === 401) clearSessionCookies(response);
      else setSessionCookies(response, rotated.access, rotated.refresh);
    }
    return response;
  } catch {
    return error(502, "Cloud API request could not be completed.");
  }
}

function safeForward(upstream: Response): NextResponse {
  if (upstream.status >= 300 && upstream.status < 400) {
    return error(502, "Upstream redirect rejected.");
  }
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-type", "content-disposition", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export async function GET(req: NextRequest, ctx: Context) { return forward(req, ctx); }
export async function POST(req: NextRequest, ctx: Context) { return forward(req, ctx); }
export async function PUT(req: NextRequest, ctx: Context) { return forward(req, ctx); }
export async function PATCH(req: NextRequest, ctx: Context) { return forward(req, ctx); }
export async function DELETE(req: NextRequest, ctx: Context) { return forward(req, ctx); }
