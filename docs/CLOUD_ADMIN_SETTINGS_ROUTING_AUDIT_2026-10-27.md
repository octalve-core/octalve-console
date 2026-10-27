# Octalve Console — Admin Settings route and authority audit
Date: 27 October 2026. Source base: d98c7a6d8adebf8d6029116e6a8726ef451d2d35.

## Verified source facts
- Sidebar Settings points to /admin/settings; all 14 hub entries have concrete Next.js pages.
- The /admin route group has a RoleGuard allowed only for admin.
- Most sections are overview-only, with static topic labels; they are not connected saved Settings editors.
- Provider record management is /admin/servers, payment gateways /admin/gateways, domain records /admin/billing/domains, and retail workbench /admin/catalog/workbench. These are different suppliers and authorities.
- Notification template list has an API loader, but the legacy New template editor posts name/event/subject/body/status whereas Django EmailTemplateSerializer requires key/name/category/subject/body_html/body_text. The old form must not claim to Save a usable template.

## Correction
- Centralize real settings-section management destinations and make each link a truthful records/review action, not a promise that external operations work.
- Remove misleading Ready labels for overview-only settings.
- Do not render the invalid New template action, and redirect legacy direct links to the template list without issuing POST.
- Add CI source contract checking all 14 hub destinations, route-specific component selection, admin guard, all management destinations and unsafe notifications editor exclusion.

## Unchanged
No API or database schema changes; no user/provider credentials, hosted checkout, registrar, mail delivery, provisioner or financial action enabled. Live authenticated browser acceptance and Production alias deployment verification remain separate gates.
