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

  // Vercel injects this identity into its own functions. The destination
  // verifies the signed token against its explicit Preview-to-Preview
  // Trusted Sources rule. Never accept a browser-provided bypass credential.
  const oidcToken = request.headers.get("x-vercel-oidc-token");
  if (!oidcToken) return null;

  return {
    apiBase: `${REVIEW_API_ORIGIN}/api`,
    protectedHeaders: {
      "x-vercel-trusted-oidc-idp-token": oidcToken,
    },
  };
}
