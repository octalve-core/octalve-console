# TLS / HSTS decision (2026-10-23)
- Vercel terminates HTTPS and forwards `x-forwarded-proto`. Trust that
  header only in the Vercel runtime. On self-hosted reverse proxies,
  configure/verify trust separately.
- Enable Django HTTPS redirects when DEBUG=false.
- Set host-level HSTS to one hour initially. Do **not** enable
  `includeSubDomains` or browser `preload` while the owner is planning
  multiple independent hosts under cloud.octalve.com and octalve.com.
- Django's security.W005 and security.W021 are documented exceptions.
  Security regression CI fails on every other warning and visibly prints
  those two policy exceptions. Reevaluate after TLS/DNS acceptance.
- Vercel may add its own HSTS response header: verify the *effective*
  value in an ordinary browser before promoting custom domains.
- CI green is **not** comprehensive penetration-test evidence.
