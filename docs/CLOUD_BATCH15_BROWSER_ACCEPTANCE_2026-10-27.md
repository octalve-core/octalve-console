# Octalve Cloud — Batch 15: Authenticated Browser Evidence and Safe CSS Retirement
Date: 27 October 2026
Baseline: main a580737cd467eb99ea33cb986a9b0251af7b6b2f (approved Batch 14 source release).
Scope: browser qualification evidence hardening only, no CSS removal, no payment/provider actions.

## Current actual status
- Existing route inventory: **134 page routes** (84 Admin, 33 Client, 10 Staff, 7 Public/Auth), six widths: 320, 360, 390, 768, 1024, 1440 = **804 required viewport observations**. This is a planned matrix, not executed evidence.
- Legacy `frontend/src/app/globals.css` still has 8,526 lines and dependencies across independently owned screens. Keep it until actual browser parity, zero legacy consumers and source/compiled CSS checks pass.
- GitHub CI-only contingency allows a reviewed **source merge** while the Review API is unavailable. It never proves Production SHA/health, real tenant browser acceptance, payment, SSO or provider readiness.
- Batch 14's French translations remain disabled by default; Arabic RTL not supported.

## Implemented in this Batch 15 tranche
1. Replace the previous permissive `browser-parity-qualification.cjs --verify` which trusted an unsigned JSON status and ten-character evidence string.
2. Require a **trusted, fingerprint-pinned Ed25519 reviewer public key**, exact 40-char release SHA and matching Console base URL. Verify a detached signature over the complete evidence payload. Do not embed private signing keys or session credentials.
3. Require role-correct route results for **every** inventory route and six distinct widths; exact dynamic fixture URL shape, independent fixture validation, five required checks and an actual in-root PNG artifact with matching SHA256 digest for each viewport. Prevent traversal, symlinks, missing and modified artifacts.
4. Add a disposable CI-only signer fixture proving that tampered signatures, wrong reviewer key, wrong role, unsafe paths and screenshot corruption are rejected. The test explicitly does NOT imply that Playwright or a real browser ran.
5. Fix corrupted duplicate PowerShell command text in `.gitignore`, retaining existing secret/build/local backup exclusions and adding private browser authentication/evidence directories.

## External authenticated execution — still required
- Start at the approved Console hostname, navigate through visible UI, use separate Client/Staff/Admin **isolated** test sessions with verified identity and tenant-owned IDs; never bypass BFF/auth by direct browser API injection or seed Production.
- Do NOT put cookies, JWTs or `playwright/.auth` in Git, PR files, public artifact links or customer screenshots. Playwright recommends isolated contexts, with auth state stored only in ignored local directories. Rotate/revoke test credentials after the review.
- For 804 cases, capture viewport-accurate PNG screenshots and check navigation, keyboard focus, responsive overflow, true data state, and accessible visible errors. Verify redirects, role boundaries, notifications, invoices, paid/unpaid truth, dynamic record IDs and ownership. Test clicks must not trigger payment, outbound email, registrar changes, hosting provisioning or OPanel session grants.
- An authorized independent reviewer signs the manifest after inspecting evidence and independently validating its exact deployment commit and environment. Pin the reviewer’s trusted public-key fingerprint out-of-band.
- The verifier checks **integrity and completeness only**, not whether screenshots are genuinely browser-produced, the person held the role, or visuals were acceptable. Those still require trace/real session evidence and human review.
- Browser acceptance must be separately recorded before updating any route to PASS-EXTERNAL or retiring CSS. Current status: **NOT QUALIFIED**.

## Proposed operator workflow
```bash
node frontend/scripts/browser-parity-qualification.cjs --plan frontend/.next/batch15-browser-plan.json
# After genuine isolated role-correct Playwright execution and signed PNG manifest:
node frontend/scripts/browser-parity-qualification.cjs --verify /private/evidence/signed.json \
  --evidence-root /private/evidence/screenshots \
  --public-key /private/reviewers/approved-ed25519.pem \
  --key-sha256 <independently-approved-SPKI-fingerprint> \
  --release-sha <exact-deployed-40-hex-git-sha>
```
Successful integrity verification is still followed by human visual sign-off, deployment SHA and authenticated runtime checks.

## Research
- https://playwright.dev/docs/auth (isolated role sessions, never commit auth state)
- https://playwright.dev/docs/test-projects (different viewports, browsers, project dependencies)
- https://playwright.dev/docs/test-assertions (auto-retrying user-visible checks)
- https://playwright.dev/docs/best-practices (test actual user-visible behavior)
- https://playwright.dev/docs/test-snapshots (visual review and environment consistency)

## Release controls
No Production database migrations or credential changes. No CSS deletion, legacy class removal, rewards activation, money movement, gateway/registrar/provisioning API calls or real outbound emails. CI green permits only reviewed source integration; Production and browser qualification remain independent gates.
