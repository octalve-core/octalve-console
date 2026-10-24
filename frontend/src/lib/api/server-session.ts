import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_ACCESS_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-octalve_console_access"
    : "octalve_console_access";
export const SESSION_REFRESH_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-octalve_console_refresh"
    : "octalve_console_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function resolveCloudApiBase() {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
  try {
    const parsed = new URL(raw);
    const local =
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (
      !(parsed.protocol === "https:" || local) ||
      parsed.pathname.replace(/\/$/, "") !== "/api" ||
      parsed.search || parsed.hash || parsed.username || parsed.password
    ) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function setSessionCookies(
  response: NextResponse,
  access: string,
  refresh?: string | null,
) {
  response.cookies.set(SESSION_ACCESS_COOKIE, access, {
    ...cookieOptions, maxAge: 60 * 60,
  });
  if (refresh) {
    response.cookies.set(SESSION_REFRESH_COOKIE, refresh, {
      ...cookieOptions, maxAge: 7 * 24 * 60 * 60,
    });
  }
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_ACCESS_COOKIE, "", {
    ...cookieOptions, maxAge: 0,
  });
  response.cookies.set(SESSION_REFRESH_COOKIE, "", {
    ...cookieOptions, maxAge: 0,
  });
}

export function sameOriginRequest(
  origin: string,
  site: string | null,
  actualOrigin: string,
): boolean {
  if (site && site !== "same-origin" && site !== "none") return false;
  if (origin) {
    try {
      return new URL(origin).origin === actualOrigin;
    } catch {
      return false;
    }
  }
  return site === "same-origin" || site === "none";
}

/**
 * Bind the actual browser IP to an API request using a short-lived HMAC.
 * Never accept a caller-supplied signature. All header values originate
 * from Vercel's trusted edge metadata and this server-side secret.
 */
export function signedClientIpHeaders(
  request: NextRequest,
  method: string,
  djangoPath: string,
): Record<string, string> {
  const secret = process.env.OCTALVE_BFF_SHARED_SECRET || "";
  if (secret.length < 32 || !process.env.VERCEL_ENV) return {};
  const rawIp = (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    ""
  ).split(",")[0].trim();
  if (!isIP(rawIp)) return {};
  const ts = String(Math.floor(Date.now() / 1000));
  const message = `v1\n${rawIp}\n${ts}\n${method}\n${djangoPath}`;
  return {
    "x-octalve-client-ip": rawIp,
    "x-octalve-client-ip-ts": ts,
    "x-octalve-client-ip-sig":
      createHmac("sha256", secret).update(message).digest("hex"),
  };
}
