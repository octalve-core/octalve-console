from django.urls import include,path
from rest_framework.routers import DefaultRouter
from .views import KnowledgeArticleViewSet
router=DefaultRouter()
router.register("",KnowledgeArticleViewSet,basename="knowledge-article")
urlpatterns=[path("",include(router.urls))]
