import { NextRequest, NextResponse } from "next/server";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_access"
  : "octalve_console_access";

const REFRESH_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_refresh"
  : "octalve_console_refresh";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

const cookieBase = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/",
};

function getToken(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isSameOriginRequest(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function denied() {
  return NextResponse.json(
    { detail: "Forbidden origin." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return denied();
  const body = await request.json().catch(() => ({}));

  const access = getToken((body as Record<string, unknown>).access);
  const refresh = getToken((body as Record<string, unknown>).refresh);

  if (!access) {
    return NextResponse.json(
      { detail: "Missing access token." },
      { status: 400 },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  response.cookies.set(ACCESS_COOKIE, access, {
    ...cookieBase,
    maxAge: ACCESS_MAX_AGE,
  });

  if (refresh) {
    response.cookies.set(REFRESH_COOKIE, refresh, {
      ...cookieBase,
      maxAge: REFRESH_MAX_AGE,
    });
  }

  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return denied();
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  response.cookies.set(ACCESS_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });

  return response;
}

/**
 * Returns the same-origin cookie session to the existing browser API client.
 * This synchronizes rotated tokens after the Next.js proxy refreshes them.
 * Authentication authority remains the backend: this route never validates
 * credentials or creates tokens, and responses must not be cached.
 */
export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) return denied();
  const access = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value ?? null;
  return NextResponse.json(
    { access, refresh },
    { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } },
  );
}
