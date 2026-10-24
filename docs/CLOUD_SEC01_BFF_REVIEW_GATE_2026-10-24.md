# Octalve Cloud — SEC-01B Same-Origin Authentication BFF

**Date:** 2026-10-24  
**Source:** `review/cloud-sec-01-bff-session`, draft PR #6, based on SEC-01A draft PR #5.  
**Status:** **REVIEW ONLY. Do not merge to main. Do not enable public registration based on this draft.**

## Security design

1. Browser API client sends all `/api` requests to Console **same-origin** `/api/cloud/...` instead of calling Django directly or attaching a bearer token.
2. Next.js route resolves only the explicitly configured Django `NEXT_PUBLIC_API_BASE_URL`, allows only fixed API root segments, rejects secret query keys, disallows redirect following and rejects cross-origin unsafe requests.
3. Login and signup are POSTed from the Console to Django by the server. Django returns JWTs only to the Next.js server; the server validates the returned access token through `/api/auth/users/me/` and sets host-only, Secure, HttpOnly and SameSite=Lax cookies. Browser receives only `{user}`, never access/refresh JWTs.
4. Protected data calls use the HttpOnly cookie on the server to attach `Authorization` to Django; bounded request bodies, no arbitrary forwarded client headers, no upstream `Set-Cookie` headers, and no exposed Vercel bypass credentials.
5. Server retries an expired access token through SimpleJWT rotation once. Cookie updates remain HttpOnly. Logout attempts server-side refresh revocation even when the access token expired, then clears local cookies; unknown revocation is surfaced as an error rather than claimed successful.
6. Legacy `/api/auth/session` POST refuses client-supplied JWT sessions, GET exposes only a Boolean rather than credentials, and browser `localStorage`/`sessionStorage` token keys are purged.

**This BFF does not yet provide an opaque server-side session registry.** JWTs are stored in HttpOnly browser cookies, not in persistent server session storage. Parallel refresh-token rotations and race outcomes must be tested before final acceptance. For an enduring BFF, consider a per-session opaque ID with encrypted, server-side token storage and auditable revocation.

## Required acceptance

- CI frontend typecheck/build, Django/security regression, static no-JWT/browser-storage checks.
- Isolated SEC-01A database includes 49th migration before any Preview authentication traffic; no shared Production database.
- Separate Preview deployment configured to reach its API despite Vercel Authentication. Do not disable Preview protection or add bypass credentials to client JS.
- Browser matrix: signup client role, login/email/username, refresh expiry and concurrent requests, logout and refresh replay denial, session renewal after hard reload and cold start, cross-tab consistency, password reset, permission enforcement on direct Django and Console-BFF API routes, forbidden CSRF Origin, iframe/cookie policy and middleware redirects.
- Confirm **no** JWT appears in DOM, JavaScript-visible responses, client storage, logs, URL/query strings, referer or analytics.
- Use synthetically generated test users and tokens; never screenshot credentials. Hostile tests include unauthorized admin/staff paths, per-account throttling and user-enumeration resistance.
- Explicit owner acceptance and rollback verification are required before merging SEC-01A, then SEC-01B, then promoting each to Production.

Sources: OWASP Session Management, OWASP Authentication, Django REST Framework Throttling, Vercel Request Headers.
