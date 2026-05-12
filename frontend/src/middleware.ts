import { NextRequest, NextResponse } from "next/server";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_access"
  : "octalve_console_access";

const REFRESH_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_refresh"
  : "octalve_console_refresh";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api.octalve.cloud";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

const PROTECTED_PREFIXES = ["/admin", "/client", "/staff"];

const AUTH_ENTRY_ROUTES = new Set([
  "/login",
  "/signup",
]);

type ConsoleRole = "admin" | "staff" | "client";

type BackendUser = {
  role?: string;
  user_type?: string;
  account_type?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
};

type SessionCheck = {
  user: BackendUser | null;
  access?: string;
  refresh?: string;
};

const cookieBase = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/",
};

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

function normalizeRole(user: BackendUser | null): ConsoleRole {
  const rawRole = String(
    user?.role ?? user?.user_type ?? user?.account_type ?? "",
  ).toLowerCase();

  if (user?.is_superuser || rawRole.includes("admin")) return "admin";
  if (user?.is_staff || rawRole.includes("staff")) return "staff";

  return "client";
}

function getHomeForRole(role: ConsoleRole) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/client";
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
    url.searchParams.set("next", nextPath);
  }

  const response = NextResponse.redirect(url);
  clearSessionCookies(response);

  return response;
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

async function fetchCurrentUser(accessToken: string): Promise<BackendUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/users/me/`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  return response.json() as Promise<BackendUser>;
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    access?: string;
    refresh?: string;
  };

  if (!payload.access) return null;

  return {
    access: payload.access,
    refresh: payload.refresh,
  };
}

async function resolveSession(request: NextRequest): Promise<SessionCheck> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const user = await fetchCurrentUser(accessToken).catch(() => null);

    if (user) {
      return {
        user,
        access: accessToken,
        refresh: refreshToken,
      };
    }
  }

  if (!refreshToken) {
    return { user: null };
  }

  const refreshed = await refreshAccessToken(refreshToken).catch(() => null);

  if (!refreshed?.access) {
    return { user: null };
  }

  const user = await fetchCurrentUser(refreshed.access).catch(() => null);

  if (!user) {
    return { user: null };
  }

  return {
    user,
    access: refreshed.access,
    refresh: refreshed.refresh ?? refreshToken,
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const session = await resolveSession(request);
    const role = normalizeRole(session.user);

    const response = session.user
      ? buildRedirect(request, getHomeForRole(role))
      : buildRedirect(request, "/login");

    applySessionCookies(response, session);

    return response;
  }

  if (AUTH_ENTRY_ROUTES.has(pathname)) {
    const session = await resolveSession(request);

    if (!session.user) {
      const response = NextResponse.next();
      clearSessionCookies(response);
      return response;
    }

    const response = buildRedirect(request, getHomeForRole(normalizeRole(session.user)));
    applySessionCookies(response, session);

    return response;
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const session = await resolveSession(request);

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
