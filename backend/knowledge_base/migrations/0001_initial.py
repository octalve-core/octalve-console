from django.conf import settings
from django.db import migrations,models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial=True
    dependencies=[migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[migrations.CreateModel(
        name="KnowledgeArticle",
        fields=[
            ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),
            ("title",models.CharField(max_length=180)),
            ("slug",models.SlugField(editable=False,max_length=220,unique=True)),
            ("category",models.CharField(max_length=80)),
            ("summary",models.CharField(max_length=320)),
            ("body_markdown",models.TextField(max_length=100000)),
            ("status",models.CharField(choices=[("draft","Draft"),("published","Published")],default="draft",max_length=16)),
            ("visibility",models.CharField(choices=[("client","Clients"),("internal","Staff only")],default="client",max_length=12)),
            ("published_at",models.DateTimeField(blank=True,null=True)),
            ("created_at",models.DateTimeField(auto_now_add=True)),
            ("updated_at",models.DateTimeField(auto_now=True)),
            ("created_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="kb_authored",to=settings.AUTH_USER_MODEL)),
        ],
        options={"ordering":["category","title"],
            "permissions":[("publish_knowledgearticle","Can publish help articles")]},
    )]
