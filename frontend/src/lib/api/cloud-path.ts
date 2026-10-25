/**
 * Django's REST endpoints are slash-terminated. Next.js can normalize the
 * browser's /api/cloud/.../ URL to a slashless URL before this handler runs.
 * Always forward the canonical Django path, rather than propagating that
 * browser-routing detail upstream and triggering Django APPEND_SLASH (301).
 *
 * Validating the incoming route segments remains the caller's responsibility.
 */
export function canonicalCloudDjangoPath(path: readonly string[]): string {
  return `/api/${path.map(encodeURIComponent).join("/")}/`;
}


/**
 * resolveCloudApiBase() already validates an upstream URL ending in "/api".
 * Django paths also begin with "/api/". Joining them unchanged creates
 * "/api/api/..." (a 404). Strip exactly one copy of the API prefix while
 * preserving the canonical trailing slash and the original query string.
 *
 * Reject non-canonical inputs instead of attempting URL repair or redirects.
 */
export function cloudUpstreamUrl(apiBase: string, djangoPath: string, query = ""): string {
  if (!apiBase.endsWith("/api") || !djangoPath.startsWith("/api/")) {
    throw new Error("Invalid canonical Cloud API route.");
  }
  return `${apiBase}${djangoPath.slice("/api".length)}${query}`;
}
