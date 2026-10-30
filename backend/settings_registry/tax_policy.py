"""Tax policy editor: stored validated policy, NEVER silently changes live checkout."""
import hashlib
from decimal import Decimal, InvalidOperation
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .console_views import SuperAdminSettings
from .models import TaxSettings,TaxPolicyRevision

FIELDS={"enable_tax","default_tax_rate","tax_calculation","enable_tax_exemption","vat_number"}
def _version(obj):
 return ("uninitialized" if obj.updated_at is None else
  hashlib.sha256((str(obj.pk)+"|"+obj.updated_at.isoformat()).encode()).hexdigest())
def _payload(obj):
 return {"revision":_version(obj),"values":{
    "enable_tax":obj.enable_tax,"default_tax_rate":str(obj.default_tax_rate),
    "tax_calculation":obj.tax_calculation,"enable_tax_exemption":obj.enable_tax_exemption,
    "vat_number":obj.vat_number or ""},
   "checkout_active":False,
   "message":"Tax configuration is saved for review; current checkout pricing does not apply these rates."}

class ConsoleTaxPolicyView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request):
    obj=TaxSettings.objects.filter(pk=1).first() or TaxSettings(pk=1)
    return Response(_payload(obj),headers={"Cache-Control":"private, no-store"})
 @transaction.atomic
 def patch(self,request):
    data=request.data
    if not isinstance(data,dict) or set(data)!={"revision","changes"} or not isinstance(data["changes"],dict) or not data["changes"] or set(data["changes"])-FIELDS:
        return Response({"detail":"Invalid tax policy fields."},status=400)
    changes={}
    for key,value in data["changes"].items():
        if key in ("enable_tax","enable_tax_exemption"):
            if type(value) is not bool:return Response({"detail":key+" must be a true/false value."},status=400)
        elif key=="tax_calculation":
            if value not in ("exclusive","inclusive"):return Response({"detail":"Invalid calculation mode."},status=400)
        elif key=="vat_number":
            if not isinstance(value,str) or len(value)>100 or any(ord(c)<32 for c in value):
                return Response({"detail":"Invalid tax registration number."},status=400)
        elif key=="default_tax_rate":
            try:
                number=Decimal(str(value))
                if not number.is_finite() or number<0 or number>30 or number.as_tuple().exponent < -2:
                    raise ValueError()
                value=number
            except (InvalidOperation,ValueError,TypeError):
                return Response({"detail":"Tax rate must be between 0 and 30 percent with two decimals."},status=400)
        changes[key]=value
    # Validate all fields before creating a singleton, then lock it.
    existing=TaxSettings.objects.filter(pk=1).first()
    if existing is None and data["revision"]!="uninitialized":
        return Response({"detail":"Tax policy changed. Reload before saving."},status=409)
    obj,_=TaxSettings.objects.get_or_create(pk=1)
    obj=TaxSettings.objects.select_for_update().get(pk=obj.pk)
    if existing is not None and data["revision"]!=_version(obj):
        return Response({"detail":"Tax policy changed. Reload before saving."},status=409)
    for key,value in changes.items():setattr(obj,key,value)
    obj.save(update_fields=[*changes,"updated_at"])
    snapshot=_payload(obj)["values"]
    last=obj.policy_revisions.order_by("-revision").first()
    tax_revision=TaxPolicyRevision.objects.create(policy=obj,
        revision=(last.revision+1 if last else 1),actor=request.user,
        snapshot=snapshot)
    from audit.models import AuditLog
    audit=AuditLog.objects.create(actor=request.user,actor_email=request.user.email,
        actor_role=request.user.role,action="settings_updated",
        entity_type="tax_policy",entity_id=str(obj.pk),details={"fields":sorted(changes),"checkout_active":False})
    return Response({**_payload(obj),"audit_id":audit.pk,
                     "tax_revision":tax_revision.revision},headers={"Cache-Control":"private, no-store"})


class ConsoleTaxHistoryView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request):
    rows=TaxPolicyRevision.objects.filter(policy_id=1).order_by("-revision")[:30]
    return Response({"revisions":[{"revision":item.revision,
         "created_at":item.created_at,"actor_id":item.actor_id,
         "snapshot":item.snapshot} for item in rows]},
         headers={"Cache-Control":"private, no-store"})
