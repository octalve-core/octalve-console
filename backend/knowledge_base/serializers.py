from rest_framework import serializers
from .models import KnowledgeArticle

class KnowledgeArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model=KnowledgeArticle
        fields=[
            "id","slug","title","category","summary","body_markdown",
            "status","visibility","published_at","created_at","updated_at",
        ]
        read_only_fields=["id","slug","published_at","created_at","updated_at"]

    def validate_body_markdown(self,value):
        if "\x00" in value:
            raise serializers.ValidationError("Invalid article content.")
        return value
