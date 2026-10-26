from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from .models import KnowledgeArticle
from .serializers import KnowledgeArticleSerializer

class KnowledgeArticleViewSet(viewsets.ModelViewSet):
    serializer_class=KnowledgeArticleSerializer
    permission_classes=[IsAuthenticated]
    queryset=KnowledgeArticle.objects.all()
    lookup_field="slug"
    http_method_names=["get","post","patch","head","options"]

    def get_queryset(self):
        user=self.request.user
        qs=KnowledgeArticle.objects.all()
        if user.is_superuser or user.role=="admin":
            return qs
        if user.role=="staff":
            return qs.filter(status="published") | qs.filter(created_by=user)
        return qs.filter(status="published",visibility="client")

    def perform_create(self,serializer):
        user=self.request.user
        if user.role not in ("admin","staff"):
            raise PermissionDenied("Publishing is limited to authorized support staff.")
        self._check_publish(user,serializer.validated_data.get("status","draft"))
        serializer.save(created_by=user)

    def perform_update(self,serializer):
        user=self.request.user
        article=self.get_object()
        if user.role not in ("admin","staff"):
            raise PermissionDenied("You cannot edit a published guide.")
        if user.role=="staff" and article.created_by_id!=user.pk and not user.has_perm(
            "knowledge_base.change_knowledgearticle"
        ):
            raise PermissionDenied("This guide is not assigned to you.")
        self._check_publish(user,serializer.validated_data.get("status",article.status))
        serializer.save()

    @staticmethod
    def _check_publish(user,status):
        if status=="published" and not (
            user.is_superuser or user.role=="admin" or
            user.has_perm("knowledge_base.publish_knowledgearticle")
        ):
            raise PermissionDenied("An administrator must approve publication.")
