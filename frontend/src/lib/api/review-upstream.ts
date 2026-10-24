import type { NextRequest } from "next/server";

/**
 * Only the isolated Cloud Auth Review API is callable from the protected
 * Console Preview. OIDC is short-lived and never exposed to the browser.
 * Production and other preview branches fail closed when this is not configured.
 */
const REVIEW_API_ORIGIN =
  "https://octalve-cloud-api-git-review-cloud-auth-to-a2b768-octalve-vault.vercel.app";

export function resolveAuthReviewUpstream(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.OCTALVE_CLOUD_REVIEW_UPSTREAM_ORIGIN !== REVIEW_API_ORIGIN
  ) {
    return null;
  }

  // The Review-only secret is supplied by the Console server environment.
  // Never accept a client header or expose it in a response or PUBLIC env var.
  const bypass = process.env.OCTALVE_CLOUD_REVIEW_BYPASS_SECRET;
  if (bypass && /^[A-Za-z0-9]{32}$/.test(bypass)) {
    return {
      apiBase: `${REVIEW_API_ORIGIN}/api`,
      protectedHeaders: { "x-vercel-protection-bypass": bypass } as Record<string, string>,
    };
  }

  // Prefer signed, short-lived project identity whenever Trusted Sources
  // becomes available on the API project.
  const oidcToken = request.headers.get("x-vercel-oidc-token");
  if (!oidcToken) return null;

  return {
    apiBase: `${REVIEW_API_ORIGIN}/api`,
    protectedHeaders: {
      "x-vercel-trusted-oidc-idp-token": oidcToken,
    } as Record<string, string>,
  };
}
