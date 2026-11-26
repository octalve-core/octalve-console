from django.urls import path
from .public_storefront import (
    PublicPublishedPlans, PublicPublishedCategories, PublicDomainPrices, PublicDomainLookup, PublicKnowledgeArticles
)

from .public_security import PublicWebRisk
from .public_google_tools import PublicDomainIdeas, PublicDocumentDraft, PublicRecommendations, PublicPageSpeed

from .public_site_inspection import PublicSiteInspection

urlpatterns = [
    path("tools/ssl/", PublicSiteInspection.as_view(), name="public-ssl-inspection"),
    path("tools/redirects/", PublicSiteInspection.as_view(operation="redirects"), name="public-redirect-inspection"),
    path("tools/domain-ideas/", PublicDomainIdeas.as_view(), name="public-domain-ideas"),
    path("tools/document-draft/", PublicDocumentDraft.as_view(), name="public-document-draft"),
    path("tools/recommendations/", PublicRecommendations.as_view(), name="public-recommendations"),
    path("tools/pagespeed/", PublicPageSpeed.as_view(), name="public-pagespeed"),
    path("tools/web-risk/", PublicWebRisk.as_view(), name="public-web-risk"),
    path("plans/", PublicPublishedPlans.as_view(), name="storefront-plans"),
    path("categories/", PublicPublishedCategories.as_view(), name="storefront-categories"),
    path("domains/prices/", PublicDomainPrices.as_view(), name="storefront-domain-prices"),
    path("domains/lookup/", PublicDomainLookup.as_view(), name="storefront-domain-lookup"),
    path("articles/", PublicKnowledgeArticles.as_view(), name="storefront-articles"),
    path("articles/<slug:slug>/", PublicKnowledgeArticles.as_view(), name="storefront-article"),
]
