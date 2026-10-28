# Octalve Console — Five-Screen Authentication UI Conversion
Source: the user-supplied `octalve_auth_complete_5_screen_preview(1).html` (28 Oct 2026). Review base: `5c361b2dedf3864c181577b0571f4da4d8fda3bf`.

## Scope and fidelity
The HTML is a single-page DESIGN PREVIEW using hash switches, dynamically injected SVG eye icons, scripted error notices and mock OTP/password behavior. These behaviors MUST NOT be copied as authentication authority. The design has been recreated as reusable React with one scenic-card module, preserving the approved Octalve Cloud logo and individual Next.js routes. The reference contains a 1,672×941 PNG background. Its WebP export is 273,266 bytes versus the 3,928,902-byte source (~93% reduction).

| HTML screen | Existing Next route | Existing authoritative behavior | Qualification |
| --- | --- | --- | --- |
| Sign in | `/login` | `useAuth().login`, server-authenticated cookie session, role-aware redirect and sanitized `next` | Source migrated; browser acceptance pending |
| Sign up | `/signup` | `useAuth().signup`, full-name/email/password validation, explicit optional referral consent, policy consent | Source migrated; browser acceptance pending |
| Forgot password | `/forgot-password` | `authApi.requestPasswordReset`; account non-enumerating notice on response | Source migrated; browser acceptance pending |
| PIN/OTP panel | `/verify-email` | **Real backend uses a token from the verification link**, not a six-digit user-entered PIN. React retains secure link handling and clears the fragment; does not accept any six-digit code. | Safe link-based verification implemented; **OTP entry NOT available** pending separately approved Django verification contract |
| Reset password | `/reset-password/confirm/[uid]/[token]` | `authApi.confirmPasswordReset(uid,token,password)` with match check, request error display and post-success login redirect | Source migrated; browser acceptance pending |

No new auth APIs, Dynamo/Neon schemas, BFF handlers, sessions, cookie lifetimes or permission scopes were modified. This is a presentation migration. Password-strength bars are advisory; backend password constraints remain authoritative. Social sign-in buttons are explicitly disabled because there is no reviewed OAuth authentication contract for them. The old nonfunctional "Remember me" checkbox was replaced by neutral secure-session copy instead of misleading the user.

## UI assets and links
- **Uploaded and Git-verified (commit `dadeaf294eb5ee8a0d7567d819b6785706533106`):** Upload `octalve-auth-background.webp` to `frontend/public/branding/octalve-auth-background.webp` in repository `octalve-core/octalve-console`. The CSS references this exact path, with a gold fallback if the asset cannot load. Do not upload the 5.3MB HTML, re-embed base64 in CSS, or store it at a second URL. **Image upload is confirmed; this branch adds explicit WebP signature and SHA verification.**
- Continue to reuse `frontend/public/branding/octalve-cloud-logo.png` through `CloudBrandLogo`, exactly as the dashboard does. Auth logo variant is resized; sidebar variant unchanged.
- Home icon and logo: `https://cloud.octalve.com`. Footer `Octalve Holding`: `https://octalve.com`. Privacy `https://cloud.octalve.com/privacy-policy`. Terms `https://cloud.octalve.com/terms-of-service`. All are real links, not hash placeholder handlers.
- The preview-only bottom-left information/badge "i" has no React equivalent. No mock toast claims code/OTP emails were sent.

## Same-PR CSS retirement
- `frontend/src/features/auth/components/AuthBrandPanel.tsx` (old dark split-panel) is deleted.
- `frontend/src/features/auth/components/AuthLayout.module.css` replaced in place with **one locally scoped** form card, logo area, labeled fields, focus states, tabs/footer, disabled provider options and mobile styling. It does not introduce a second global stylesheet.
- `frontend/src/app/globals.css` **8,502 → 8,460 lines**, Git blob `4bade3c74196118a0372adc60f94dcd7fa817ad1`, 153,180 bytes. Removed exactly 42 lines of obsolete `.auth-layout`, `.auth-brand`, `.auth-copy`, `.auth-bars`, `.auth-panel`, `.auth-card` and their responsive overrides. Shared `.brand-*`, `.app-shell`, root Tailwind directives and other ownership remain intact.
- This retirement is verified by `frontend/scripts/check-auth-five-screen-ui.cjs` against the complete TypeScript/JSX source and frozen CSS inventory. The new scoped CSS does not imply any other global compatibility selectors may be deleted.

## Release and acceptance
The five routes need 320/360/390/768/1024/1440 viewport evidence; each must cover valid and invalid email, signup mismatch/consent/referral, API errors, disabled form/button and password reveal, password-reset delivery non-enumeration and expired/valid uid-token, verification expired/valid link, focus/keyboard/no overflow/screen readers. **Use isolated Review accounts and synthetic credentials/links only.** Never send production OTPs to test addresses, collect funds, provision service or expose tokens in browser screenshots.

Carry forward release gates: 135 routes × six widths = **810 authenticated/public browser cases** and independent financial-report export/currency qualification (Issues #88 and #89). The existing Django admin financial-read authorization patch #86 is merged. Source CI success alone is NOT signed browser qualification. Do not claim new Production deployment without exact release commit SHA and Vercel evidence; image asset integrity is verified; public deployment and browser checks remain separate acceptance dependencies.
