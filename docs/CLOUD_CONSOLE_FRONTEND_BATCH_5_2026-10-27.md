# Octalve Console — Batch 5 Support and Knowledge
Baseline: Batch 4 merge `206d0ed0c07a99264b0711580d5f1007e7b92cf6` (27 October 2026).
Scope: **Frontend-only** role-aware ticket and knowledge UI componentization. Existing Backend Django state, server RBAC and routing remain authoritative.

## Implemented
- New small `features/support/components/` sections for Client ticket request, shared Client/Staff/Admin ticket record cards, message thread, reply composer, Admin specialist selector/actions, department/topic creation forms and published/management article cards.
- Client request retains active department/topic lookup, clientApi create, required 10+ character details, chosen priority and navigation only after a confirmed persisted ticket response.
- Staff/Admin support desk continues to load `supportApi.tickets()`, filter by status and link to existing role-specific detail route. Client support home still lists only its authorized `clientApi.tickets()` response.
- Ticket detail parent still uses `helpApi.ticket/reply/action`. Client cannot mark a reply as an internal note. Admin agent selection is bounded by assigned department and routing-topic memberships, with Django remaining final authorization.
- Admin routing settings still use actual department/topic/agent membership writes; new form sections receive handlers as props, never call APIs or pretend an assignment succeeded.
- Client knowledge discovery still reads the live help API with category/search filters; Staff/Admin article management shares cards and typed editor fields with real `helpApi.create/update/article/articles`. Markdown rendering stays in existing plain-text-safe `MarkdownArticle`.
- Existing CSS `globals.css` remains frozen; no new stylesheet or dependency, no Backend/API/migration/provider changes.

## Findings and deferred cleanup
- Some legacy static/demo knowledge widgets (`KnowledgeBaseGrid`, `KnowledgeArticleEditor`, and `StaffKnowledgeArticleView`) are **not active** in the live routes covered here. They were not connected to article publication or ticket handling because doing so would mix fake data with verified Django records. Their removal or replacement requires route-use confirmation in later batch review.
- Global CSS migration remains Batch 8 only after route-level browser parity; route inventory and original CSS blob checks remain enabled.
- Existing Backend gaps and wishlist improvements are documented only, to be considered together after the approved Batch 0–8 modernization.

## Release gates
Review the exact `review/cloud` commit with Next/TypeScript production build, Batch 0–5 source and emitted Tailwind contracts, existing Django support routing and knowledge-base suite, security and disposable PostgreSQL acceptance. Merge only with qualified PR head. Verify both Console/API production aliases at merge SHA and manually inspect authenticated 320/360/390/768/1024/1440px layouts. Never send real customer messages as part of visual acceptance.
