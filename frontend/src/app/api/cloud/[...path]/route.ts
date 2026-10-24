import { NextRequest, NextResponse } from "next/server";
import { resolveAuthReviewUpstream } from "@/lib/api/review-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

const SENSITIVE_QUERY_KEYS = new Set([
  "password", "new_password", "re_new_password", "re_password",
  "token", "access", "refresh", "secret", "secret_key", "api_key",
]);
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function errorResponse(status: number, detail: string) {
  return NextResponse.json(
    { detail },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function forward(request: NextRequest, context: RouteContext) {
  const upstream = resolveAuthReviewUpstream(request);
  if (!upstream) {
    return errorResponse(503, "Review API server-to-server identity is unavailable.");
  }

  const { path } = await context.params;
  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    path.some((part) => !part || part === "." || part === ".." ||
      part.includes("/") || part.includes("\\"))
  ) {
    return errorResponse(400, "Invalid API path.");
  }

  for (const key of request.nextUrl.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      return errorResponse(400, "Sensitive query parameters are not permitted.");
    }
  }

  // The destination host is pinned in review-upstream.ts; user input may
  // control only encoded path segments and ordinary query parameters.
  const remotePath = path.map((part) => encodeURIComponent(part)).join("/");
  const target = `${upstream.apiBase}/${remotePath}${request.nextUrl.search}`;

  const headers = new Headers(upstream.protectedHeaders);
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  const bearer = request.headers.get("authorization");
  headers.set("Accept", accept || "application/json");
  if (contentType) headers.set("Content-Type", contentType);
  if (bearer) headers.set("Authorization", bearer);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return errorResponse(413, "Request body too large.");
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return errorResponse(413, "Request body too large.");
    }
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    // A redirect usually means Vercel protection intercepted the request.
    // Do not leak upstream redirect/cookie headers into the Console origin.
    if (response.status >= 300 && response.status < 400) {
      return errorResponse(502, "Review API did not authorize the upstream request.");
    }

    const outgoing = new Headers({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["content-type", "content-disposition"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return errorResponse(502, "Review API request could not be completed.");
  }
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  return forward(request, ctx);
}
export async function POST(request: NextRequest, ctx: RouteContext) {
  return forward(request, ctx);
}
export async function PUT(request: NextRequest, ctx: RouteContext) {
  return forward(request, ctx);
}
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  return forward(request, ctx);
}
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  return forward(request, ctx);
}
