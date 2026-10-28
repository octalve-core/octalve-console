import { NextRequest, NextResponse } from "next/server";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_access"
  : "octalve_console_access";

const REFRESH_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_refresh"
  : "octalve_console_refresh";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const SAFE_API_BASE = (() => {
  try {
    const parsed = new URL(API_BASE_URL);
    const validProtocol = parsed.protocol === "https:" ||
      (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname));
    return validProtocol && parsed.pathname.replace(/\/$/, "") === "/api" &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      ? API_BASE_URL
      : null;
  } catch {
    return null;
  }
})();

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

const PROTECTED_PREFIXES = ["/admin", "/client", "/staff"];

const AUTH_ENTRY_ROUTES = new Set(["/login", "/signup"]);

const SENSITIVE_QUERY_KEYS = new Set([
  "password",
  "new_password",
  "re_new_password",
  "re_password",
  "current_password",
  "token",
  "access",
  "refresh",
  "secret",
  "secret_key",
  "api_key",
]);

const REDIRECT_QUERY_KEYS = new Set([
  "next",
  "redirect",
  "redirect_to",
  "return",
  "return_to",
  "callback",
  "callback_url",
  "callbackUrl",
]);

type ConsoleRole = "admin" | "staff" | "client";

type BackendGroup =
  | string
  | {
      name?: string | null;
      role?: string | null;
    };

type BackendUser = {
  id?: number | string;
  email?: string;
  role?: string | null;
  user_type?: string | null;
  account_type?: string | null;
  type?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_admin?: boolean;
  is_client?: boolean;
  groups?: BackendGroup[] | null;
};

type SessionCheck = {
  user: BackendUser | null;
  unavailable?: boolean;
  access?: string;
  refresh?: string;
};

const cookieBase = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/",
};

function readGroupValues(groups?: BackendGroup[] | null) {
  if (!Array.isArray(groups)) return "";

  return groups
    .map((group) => {
      if (typeof group === "string") return group;
      return `${group.name ?? ""} ${group.role ?? ""}`;
    })
    .join(" ")
    .toLowerCase();
}

function normalizeRole(user: BackendUser | null): ConsoleRole {
  const combined = [
    user?.role,
    user?.user_type,
    user?.account_type,
    user?.type,
    readGroupValues(user?.groups),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    user?.is_superuser ||
    user?.is_admin ||
    combined.includes("superuser") ||
    combined.includes("administrator") ||
    combined.includes("admin")
  ) {
    return "admin";
  }

  if (
    user?.is_staff ||
    combined.includes("staff") ||
    combined.includes("support") ||
    combined.includes("agent")
  ) {
    return "staff";
  }

  return "client";
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getRequiredRole(pathname: string): ConsoleRole | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/staff" || pathname.startsWith("/staff/")) return "staff";
  if (pathname === "/client" || pathname.startsWith("/client/")) return "client";

  return null;
}

function getHomeForRole(role: ConsoleRole) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/client";
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });
}

function applySessionCookies(response: NextResponse, session: SessionCheck) {
  if (session.access) {
    response.cookies.set(ACCESS_COOKIE, session.access, {
      ...cookieBase,
      maxAge: ACCESS_MAX_AGE,
    });
  }

  if (session.refresh) {
    response.cookies.set(REFRESH_COOKIE, session.refresh, {
      ...cookieBase,
      maxAge: REFRESH_MAX_AGE,
    });
  }
}

function sanitizeRedirectValue(value: string) {
  const rawValue = value.trim();

  if (!rawValue) return "";
  if (!rawValue.startsWith("/")) return "";
  if (rawValue.startsWith("//")) return "";

  try {
    const url = new URL(rawValue, "https://console.octalve.cloud");

    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    const safePath = `${url.pathname}${url.search}${url.hash}`;

    if (safePath === "/login" || safePath.startsWith("/login?")) return "";
    if (safePath === "/signup" || safePath.startsWith("/signup?")) return "";
    if (safePath === "/forgot-password" || safePath.startsWith("/forgot-password?")) return "";

    return safePath;
  } catch {
    return "";
  }
}

function sanitizeRequestUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  let changed = false;

  for (const key of Array.from(url.searchParams.keys())) {
    const normalizedKey = key.toLowerCase();

    if (SENSITIVE_QUERY_KEYS.has(normalizedKey)) {
      url.searchParams.delete(key);
      changed = true;
      continue;
    }

    if (REDIRECT_QUERY_KEYS.has(key) || REDIRECT_QUERY_KEYS.has(normalizedKey)) {
      const values = url.searchParams.getAll(key);
      url.searchParams.delete(key);

      for (const value of values) {
        const safeValue = sanitizeRedirectValue(value);

        if (safeValue) {
          url.searchParams.append(key, safeValue);
        }

        if (safeValue !== value) {
          changed = true;
        }
      }
    }
  }

  return {
    changed,
    url,
  };
}

function buildSafeQueryRedirect(request: NextRequest) {
  const { changed, url } = sanitizeRequestUrl(request);

  if (!changed) return null;

  const response = NextResponse.redirect(url);

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}

function buildRedirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function buildLoginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  url.pathname = "/login";
  url.search = "";

  if (nextPath !== "/login") {
    url.searchParams.set("next", sanitizeRedirectValue(nextPath) || request.nextUrl.pathname);
  }

  const response = NextResponse.redirect(url);
  clearSessionCookies(response);

  return response;
}

/** Never confuse an unavailable identity service with a rejected token.
 * An outage produces 503 without exposing protected content or clearing cookies.
 */
class IdentityUnavailable extends Error {}
function invalidAuth(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}
async function fetchCurrentUser(accessToken: string): Promise<BackendUser | null> {
  if (!SAFE_API_BASE) throw new IdentityUnavailable();
  const response = await fetch(`${SAFE_API_BASE}/auth/users/me/`, {
    method: "GET",
    headers: {Accept: "application/json",Authorization: `Bearer ${accessToken}`},
    cache: "no-store",
    signal: AbortSignal.timeout(4500),
  });
  if (invalidAuth(response)) return null;
  if (!response.ok) throw new IdentityUnavailable();
  const user: unknown = await response.json();
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    throw new IdentityUnavailable();
  }
  const identity=user as BackendUser;
  if (!((typeof identity.id==="number"&&Number.isSafeInteger(identity.id)&&identity.id>0) ||
         (typeof identity.id==="string"&&/^[1-9][0-9]{0,19}$/.test(identity.id))) ||
      typeof identity.email!=="string" ||
      !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(identity.email)) {
    throw new IdentityUnavailable();
  }
  return identity;
}
async function refreshAccessToken(refreshToken: string) {
  if (!SAFE_API_BASE) throw new IdentityUnavailable();
  const response = await fetch(`${SAFE_API_BASE}/auth/jwt/refresh/`, {
    method: "POST",
    headers: {Accept: "application/json","Content-Type": "application/json"},
    body: JSON.stringify({refresh: refreshToken}),
    cache: "no-store",
    signal: AbortSignal.timeout(4500),
  });
  if (invalidAuth(response)) return null;
  if (!response.ok) throw new IdentityUnavailable();
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new IdentityUnavailable();
  }
  const record=payload as {access?:unknown;refresh?:unknown};
  if (typeof record.access!=="string" || !record.access ||
      (record.refresh!==undefined && typeof record.refresh!=="string")) {
    throw new IdentityUnavailable();
  }
  return {access:record.access,refresh:record.refresh as string|undefined};
}

async function resolveSession(request: NextRequest): Promise<SessionCheck> {
  const accessToken=request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken=request.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (accessToken) {
      const user=await fetchCurrentUser(accessToken);
      if (user) return {user,access:accessToken,refresh:refreshToken};
    }
    if (!refreshToken) return {user:null};
    const refreshed=await refreshAccessToken(refreshToken);
    if (!refreshed) return {user:null};
    const user=await fetchCurrentUser(refreshed.access);
    if (!user) return {user:null};
    return {user,access:refreshed.access,refresh:refreshed.refresh??refreshToken};
  } catch {
    return {user:null,unavailable:true};
  }
}

function unavailableIdentityResponse():NextResponse{
  return new NextResponse("Account verification is temporarily unavailable. Please try again.",{
    status:503,
    headers:{"Cache-Control":"private, no-store","Retry-After":"10",
             "Content-Type":"text/plain; charset=utf-8"},
  });
}

export async function proxy(request: NextRequest) {
  const safeQueryRedirect = buildSafeQueryRedirect(request);

  if (safeQueryRedirect) {
    return safeQueryRedirect;
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const session = await resolveSession(request);

    if (session.unavailable) return unavailableIdentityResponse();
    const response = session.user
      ? buildRedirect(request, getHomeForRole(normalizeRole(session.user)))
      : buildRedirect(request, "/login");

    applySessionCookies(response, session);

    return response;
  }

  if (AUTH_ENTRY_ROUTES.has(pathname)) {
    const session = await resolveSession(request);

    if (session.unavailable) return unavailableIdentityResponse();
    if (!session.user) {
      const response = NextResponse.next();
      clearSessionCookies(response);
      return response;
    }

    const response = buildRedirect(
      request,
      getHomeForRole(normalizeRole(session.user)),
    );

    applySessionCookies(response, session);

    return response;
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const session = await resolveSession(request);
  if (session.unavailable) return unavailableIdentityResponse();

  if (!session.user) {
    return buildLoginRedirect(request);
  }

  const userRole = normalizeRole(session.user);
  const requiredRole = getRequiredRole(pathname);

  if (requiredRole && userRole !== requiredRole) {
    const response = buildRedirect(request, getHomeForRole(userRole));
    applySessionCookies(response, session);

    return response;
  }

  const response = NextResponse.next();
  applySessionCookies(response, session);

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
