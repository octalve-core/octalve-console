import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

class KnowledgeArticle(models.Model):
    """Plain Markdown only; never store/render trusted customer HTML."""
    STATUS_CHOICES=[("draft","Draft"),("published","Published")]
    VISIBILITY_CHOICES=[("client","Clients"),("internal","Staff only")]
    title=models.CharField(max_length=180)
    slug=models.SlugField(max_length=220,unique=True,editable=False)
    category=models.CharField(max_length=80)
    summary=models.CharField(max_length=320)
    body_markdown=models.TextField(max_length=100000)
    status=models.CharField(max_length=16,choices=STATUS_CHOICES,default="draft")
    visibility=models.CharField(max_length=12,choices=VISIBILITY_CHOICES,default="client")
    created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name="kb_authored")
    published_at=models.DateTimeField(null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        ordering=["category","title"]
        permissions=[("publish_knowledgearticle","Can publish help articles")]

    def save(self,*args,**kwargs):
        if not self.slug:
            self.slug=(slugify(self.title)[:180] or "guide")+"-"+uuid.uuid4().hex[:8]
        if self.status=="published" and not self.published_at:
            self.published_at=timezone.now()
        if self.status=="draft":
            self.published_at=None
        super().save(*args,**kwargs)
