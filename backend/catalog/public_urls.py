from django.urls import path
from .public_storefront import (
    PublicPublishedPlans, PublicPublishedCategories, PublicDomainPrices, PublicDomainLookup, PublicKnowledgeArticles
)

from .public_security import PublicWebRisk

urlpatterns = [
    path("tools/web-risk/", PublicWebRisk.as_view(), name="public-web-risk"),
    path("plans/", PublicPublishedPlans.as_view(), name="storefront-plans"),
    path("categories/", PublicPublishedCategories.as_view(), name="storefront-categories"),
    path("domains/prices/", PublicDomainPrices.as_view(), name="storefront-domain-prices"),
    path("domains/lookup/", PublicDomainLookup.as_view(), name="storefront-domain-lookup"),
    path("articles/", PublicKnowledgeArticles.as_view(), name="storefront-articles"),
    path("articles/<slug:slug>/", PublicKnowledgeArticles.as_view(), name="storefront-article"),
]
