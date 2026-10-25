from django.urls import path
from .views import AuthorizeView, ExchangeView, EntitlementView

urlpatterns = [
    path("authorize/", AuthorizeView.as_view(), name="opanel-authorize"),
    path("exchange/", ExchangeView.as_view(), name="opanel-exchange"),
    path("entitlement/", EntitlementView.as_view(), name="opanel-entitlement"),
]
