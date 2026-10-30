"""Actual template editor and safe outbox operator readback, no raw send endpoint."""
import hashlib
import uuid
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .console_views import SuperAdminSettings
from .mail_authority import validate_content,preview,TOKENS
from .models import EmailTemplate,EmailTemplateRevision,ConsoleMailOutbox

def revision(template):
    return hashlib.sha256((str(template.pk)+":"+template.updated_at.isoformat()).encode()).hexdigest()

def serialize(template):
    return {"id":template.pk,"key":template.key,"name":template.name,
            "category":template.category,"subject":template.subject,
            "body_text":template.body_text,"is_active":template.is_active,
            "is_system":template.is_system,"revision":revision(template),
            "created_at":template.created_at,"updated_at":template.updated_at}

def safe_payload(data,creating=False):
    allowed={"name","category","subject","body_text","is_active"}
    if not hasattr(data,"keys") or set(data)-allowed or (creating and not {"name","category","subject","body_text"}<=set(data)):
        raise ValueError("Only reviewed template fields are accepted.")
    out={}
    if "name" in data:
        if not isinstance(data["name"],str) or not 3<=len(data["name"].strip())<=100:
            raise ValueError("Enter a valid template name.")
        out["name"]=data["name"].strip()
    if "category" in data:
        if data["category"] not in dict(EmailTemplate.CATEGORY_CHOICES):
            raise ValueError("Choose an existing message category.")
        out["category"]=data["category"]
    for key in ("subject","body_text"):
        if key in data:out[key]=data[key]
    if "is_active" in data:
        if not isinstance(data["is_active"],bool):
            raise ValueError("Status must be a boolean.")
        out["is_active"]=data["is_active"]
    return out

class TemplateListView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request):
    rows=EmailTemplate.objects.order_by("category","name","pk")[:200]
    return Response({"results":[serialize(x) for x in rows],
                     "total":EmailTemplate.objects.count(),
                     "truncated":EmailTemplate.objects.count()>200,
                     "variables":TOKENS},headers={"Cache-Control":"private, no-store"})
 def post(self,request):
    try:
        values=safe_payload(request.data,True)
        validate_content(values["subject"],values["body_text"])
    except (ValueError,TypeError,KeyError) as exc:
        return Response({"detail":str(exc)},status=400)
    name=values.pop("name")
    category=values.pop("category")
    subject=values.pop("subject")
    body=values.pop("body_text")
    key=(slugify(name)[:65] or "message")+"-"+uuid.uuid4().hex[:12]
    with transaction.atomic():
        item=EmailTemplate.objects.create(key=key,name=name,category=category,
            description="",subject=subject,body_text=body,body_html="",
            is_active=values.get("is_active",False))
        EmailTemplateRevision.objects.create(template=item,revision=1,actor=request.user,
            snapshot={"name":name,"category":category,"subject":subject,"body_text":body,"is_active":item.is_active})
    return Response(serialize(item),status=201)

class TemplateDetailView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request,pk):
    return Response(serialize(get_object_or_404(EmailTemplate,pk=pk)),
                    headers={"Cache-Control":"private, no-store"})
 def patch(self,request,pk):
    if not hasattr(request.data,"keys") or "revision" not in request.data:
        return Response({"detail":"The current revision is required."},status=400)
    try:values=safe_payload({k:v for k,v in request.data.items() if k!="revision"})
    except (ValueError,TypeError) as exc:return Response({"detail":str(exc)},status=400)
    if not values:return Response({"detail":"Choose at least one change."},status=400)
    with transaction.atomic():
        obj=get_object_or_404(EmailTemplate.objects.select_for_update(),pk=pk)
        if request.data["revision"]!=revision(obj):
            return Response({"detail":"Template changed. Reload before saving."},status=409)
        subject=values.get("subject",obj.subject)
        body=values.get("body_text",obj.body_text)
        try:validate_content(subject,body)
        except ValueError as exc:return Response({"detail":str(exc)},status=400)
        before={"name":obj.name,"category":obj.category,"subject":obj.subject,"body_text":obj.body_text,"is_active":obj.is_active}
        for key,value in values.items():setattr(obj,key,value)
        obj.body_html="" # force safe render from text; never retain untrusted arbitrary HTML
        obj.save()
        latest=obj.revisions.order_by("-revision").first()
        EmailTemplateRevision.objects.create(template=obj,actor=request.user,
            revision=(latest.revision if latest else 0)+1,
            snapshot=before)
    return Response(serialize(obj),headers={"Cache-Control":"private, no-store"})

class TemplateDuplicateView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def post(self,request,pk):
    if request.data not in ({},None):
        return Response({"detail":"This action takes no custom fields."},status=400)
    source=get_object_or_404(EmailTemplate,pk=pk)
    with transaction.atomic():
        clone=EmailTemplate.objects.create(key=(slugify(source.name)[:60] or "template")+"-"+uuid.uuid4().hex[:12],
            name=(source.name+" copy")[:200],category=source.category,
            description=source.description,subject=source.subject,body_text=source.body_text,
            body_html="",is_active=False,is_system=False)
        EmailTemplateRevision.objects.create(template=clone,revision=1,actor=request.user,
            snapshot={"duplicated_from":source.pk})
    return Response(serialize(clone),status=201)

class TemplatePreviewView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def post(self,request,pk):
    if request.data not in ({},None):return Response({"detail":"Preview uses safe sample data only."},status=400)
    obj=get_object_or_404(EmailTemplate,pk=pk)
    try:return Response(preview(obj),headers={"Cache-Control":"private, no-store"})
    except ValueError as exc:return Response({"detail":str(exc)},status=400)

class OutboxDashboardView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request):
    total={key:ConsoleMailOutbox.objects.filter(status=key).count() for key in
           ("queued","processing","sent","needs_review","failed","suppressed")}
    rows=ConsoleMailOutbox.objects.order_by("-created_at")[:50]
    return Response({"counts":total,"results":[{
      "id":i.pk,"recipient":i.recipient,"subject":i.subject,"audience":i.audience,
      "status":i.status,"attempts":i.attempts,"provider":i.provider,
      "created_at":i.created_at,"sent_at":i.sent_at,
    } for i in rows],"sender_ready":False,"message":"Delivery requires verified sender certification."},
    headers={"Cache-Control":"private, no-store"})
