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
