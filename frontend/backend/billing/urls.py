# billing/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet, TaxViewSet, QuoteViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'taxes', TaxViewSet, basename='tax')
router.register(r'quotes', QuoteViewSet, basename='quote')

urlpatterns = [
    path('', include(router.urls)),
]