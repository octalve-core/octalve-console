# catalog/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductCategoryViewSet, ProductViewSet, PlanViewSet, PlanProviderMappingViewSet
from .offer_management import OfferDraftViewSet

router = DefaultRouter()
router.register(r'categories', ProductCategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'plans', PlanViewSet)
router.register(r'provider-mappings', PlanProviderMappingViewSet)
router.register(r'offer-drafts', OfferDraftViewSet, basename='offer-drafts')

urlpatterns = [
    path('', include(router.urls)),
]