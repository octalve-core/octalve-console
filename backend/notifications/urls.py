from django.urls import path
from .customer_views import (
    CustomerInbox, CustomerNoticeRead, CustomerNoticePreferences,
    CustomerCommunity,
)

urlpatterns = [
    path("inbox/", CustomerInbox.as_view(), name="client-notification-inbox"),
    path("read/", CustomerNoticeRead.as_view(), name="client-notification-read"),
    path("preferences/", CustomerNoticePreferences.as_view(), name="client-notification-preferences"),
    path("community/", CustomerCommunity.as_view(), name="client-community-links"),
]
