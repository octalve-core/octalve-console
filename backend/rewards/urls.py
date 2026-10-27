from django.urls import path
from .views import (
    MyRewards, AffiliateApply, RecognitionDismiss, AdminRewardsStats,
    AdminAffiliateReview, AdminAffiliateList, AdminGrantPurchasePoints, AdminRecognize,
)
urlpatterns=[
    path("me/",MyRewards.as_view(),name="client-rewards"),
    path("affiliate/apply/",AffiliateApply.as_view(),name="affiliate-apply"),
    path("recognitions/<int:pk>/dismiss/",RecognitionDismiss.as_view(),name="recognition-dismiss"),
    path("admin/stats/",AdminRewardsStats.as_view(),name="admin-rewards-stats"),
    path("admin/affiliates/",AdminAffiliateList.as_view(),name="admin-affiliate-list"),
    path("admin/affiliates/<int:pk>/review/",AdminAffiliateReview.as_view(),name="admin-affiliate-review"),
    path("admin/purchases/award/",AdminGrantPurchasePoints.as_view(),name="admin-rewards-award"),
    path("admin/recognitions/",AdminRecognize.as_view(),name="admin-recognition"),
]
