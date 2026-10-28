# Octalve Cloud Console brand asset

Place the user-approved transparent PNG at the exact path:
`frontend/public/branding/octalve-cloud-logo.png`

The Console sidebar renders **only this logo** on a white brand bar, like Octalve Finance.
For a short period before the asset is uploaded it falls back to the existing
Octalve asset at `frontend/public/assets/logo/octalve.png`.
Keep the original PNG's transparent background; preserve aspect ratio.
Do not add separate Octalve Console/Cloud business OS label text.

## Five-screen authentication artwork (28 Oct 2026)

The user-approved scenic illustration in the HTML preview is **one image**.
Upload the optimized WebP file at exactly:

`frontend/public/branding/octalve-auth-background.webp`

It is served at `/branding/octalve-auth-background.webp` by Next.js. The
single `features/auth/components/AuthLayout.module.css` owns its background;
never inline a multi-megabyte base64 string or import the untrusted preview's
`<script>` into React. The stylesheet provides a flat gold fallback until
the artwork is uploaded. For release acceptance, the actual file must return
HTTP 200 on the qualified Review deployment, have image MIME type and be
visually verified at 320, 360, 390, 768, 1024 and 1440 px.

The **existing approved** `octalve-cloud-logo.png` remains the sole Cloud
identity asset for dashboard and auth views; the preview's separately embedded
logo is intentionally NOT a new branding authority.
