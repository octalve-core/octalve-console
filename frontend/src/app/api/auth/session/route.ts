import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_ACCESS_COOKIE,
  SESSION_REFRESH_COOKIE,
  clearSessionCookies,
  sameOriginRequest,
} from "@/lib/api/server-session";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

export async function GET(request: NextRequest) {
  // Never disclose JWTs or refresh tokens to browser JavaScript.
  return NextResponse.json(
    {
      authenticated: Boolean(
        request.cookies.get(SESSION_ACCESS_COOKIE)?.value ||
        request.cookies.get(SESSION_REFRESH_COOKIE)?.value,
      ),
    },
    { headers },
  );
}

export async function POST() {
  // Legacy client-supplied JWT exchange is prohibited. Session creation
  // happens only through the server-side BFF credential exchange.
  return NextResponse.json(
    { detail: "Use the secure authentication exchange." },
    { status: 405, headers },
  );
}

export async function DELETE(request: NextRequest) {
  if (!sameOriginRequest(
    request.headers.get("origin") || "",
    request.headers.get("sec-fetch-site"),
    request.nextUrl.origin,
  )) {
    return NextResponse.json(
      { detail: "Forbidden origin." },
      { status: 403, headers },
    );
  }
  const response = NextResponse.json({ ok: true }, { headers });
  clearSessionCookies(response);
  return response;
}
