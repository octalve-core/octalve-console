"""Tax policy editor: stored validated policy, NEVER silently changes live checkout."""
import hashlib
from decimal import Decimal, InvalidOperation
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .console_views import SuperAdminSettings
from .models import TaxSettings

FIELDS={"enable_tax","default_tax_rate","tax_calculation","enable_tax_exemption","vat_number"}
def _version(obj):
 return hashlib.sha256((str(obj.pk)+"|"+obj.updated_at.isoformat()).encode()).hexdigest()
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
    obj,_=TaxSettings.objects.get_or_create(pk=1)
    return Response(_payload(obj),headers={"Cache-Control":"private, no-store"})
 @transaction.atomic
 def patch(self,request):
    data=request.data
    if not isinstance(data,dict) or set(data)!={"revision","changes"} or not isinstance(data["changes"],dict) or not data["changes"] or set(data["changes"])-FIELDS:
        return Response({"detail":"Invalid tax policy fields."},status=400)
    obj,_=TaxSettings.objects.get_or_create(pk=1)
    obj=TaxSettings.objects.select_for_update().get(pk=obj.pk)
    if data["revision"]!=_version(obj):
        return Response({"detail":"Tax policy changed. Reload before saving."},status=409)
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
    for key,value in changes.items():setattr(obj,key,value)
    obj.save(update_fields=[*changes,"updated_at"])
    from audit.models import AuditLog
    audit=AuditLog.objects.create(actor=request.user,actor_email=request.user.email,
        actor_role=request.user.role,action="settings_updated",
        entity_type="tax_policy",entity_id=str(obj.pk),details={"fields":sorted(changes),"checkout_active":False})
    return Response({**_payload(obj),"audit_id":audit.pk},headers={"Cache-Control":"private, no-store"})
