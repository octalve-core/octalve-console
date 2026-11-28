"""Platform-wide worker scheduling with durable per-lane leases.

This is scheduling authority, not payment, supplier or customer authorization.
Existing domain, financial and mutation fences remain mandatory.
"""
import json
import os
import secrets
import uuid
from datetime import timedelta
from hashlib import sha256
from django.conf import settings
from django.db import connection,transaction,DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from settings_registry.models import Setting,SettingGroup

PREFIX="commercial_worker_v1_"
LANES=("payments","staging","provisioning","mail","renewals","lifecycle","cancellation")
LEASE=timedelta(minutes=6)

def enabled():
    return bool(getattr(settings,"CLOUD_COMMERCIAL_SCHEDULER_ENABLED",False))

def _state(row):
    try:
        value=json.loads(row.value or "{}")
        if isinstance(value,dict):
            return value
    except (TypeError,ValueError):
        pass
    return {}

@transaction.atomic
def claim(lane):
    if not enabled() or lane not in LANES or connection.vendor!="postgresql":
        return None
    # Transaction-scoped lock works with transaction-pooling connections.
    number=int.from_bytes(sha256((PREFIX+lane).encode()).digest()[:8],"big",signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)",[number])
    group,_=SettingGroup.objects.get_or_create(key="cron",defaults={"name":"Scheduled operations"})
    row,_=Setting.objects.select_for_update().get_or_create(group=group,key=PREFIX+lane,defaults={
        "name":"Internal worker state","data_type":"json","is_public":False,"is_deprecated":True,"value":"{}"})
    state=_state(row)
    now=timezone.now()
    if state.get("lease"):
        until=parse_datetime(state.get("lease_until",""))
        if not until or timezone.is_naive(until) or until>now:
            return None
    token=uuid.uuid4().hex
    state.update(lease=token,lease_until=(now+LEASE).isoformat(),started_at=now.isoformat())
    row.value=json.dumps(state)
    row.save(update_fields=["value","updated_at"])
    return token

@transaction.atomic
def finish(lane,token,result,failed=False):
    row=Setting.objects.select_for_update().get(group__key="cron",key=PREFIX+lane)
    state=_state(row)
    if state.get("lease")!=token:
        return
    # Only aggregate counters; never save arbitrary supplier payloads.
    metrics={k:v for k,v in result.items() if k in ("enabled","processed","staged","completed","held","accepted","quarantined",
             "reconciled","issued","applied","reminders","suspended","restored","cancelled","terminated")
             and (type(v) is bool or type(v) is int and 0<=v<=10000)}
    state.update(lease="",lease_until="",completed_at=timezone.now().isoformat(),failed=bool(failed),metrics=metrics)
    row.value=json.dumps(state)
    row.save(update_fields=["value","updated_at"])

def run_lane(lane):
    if lane=="payments":
        from payments.live_reconciliation import run_due
    elif lane=="staging":
        from provisioning.automatic_staging import run_due_staging as run_due
    elif lane=="provisioning":
        from provisioning.automatic_dispatch import run_due_dispatch as run_due
    elif lane=="mail":
        from settings_registry.mail_runtime import run_due_mail as run_due
    elif lane=="renewals":
        from services.renewals import run_due
    elif lane=="lifecycle":
        from services.hosting_lifecycle import run_due
    elif lane=="cancellation":
        from services.hosting_cancellation import run_due
    else:
        raise ValueError("Unknown worker lane.")
    return run_due(1 if lane in ("provisioning","mail","lifecycle","cancellation") else 5)

def status():
    now=timezone.now()
    rows={x.key:_state(x) for x in Setting.objects.filter(group__key="cron",key__in=[PREFIX+x for x in LANES])}
    result=[]
    for lane in LANES:
        state=rows.get(PREFIX+lane,{})
        try:
            completed=parse_datetime(state.get("completed_at","")) if state.get("completed_at") else None
        except (TypeError,ValueError):
            completed=None
        age=(now-completed).total_seconds() if completed and not timezone.is_naive(completed) else None
        maximum=1800 if lane in ("renewals","lifecycle","cancellation") else 300
        result.append({"lane":lane,"healthy":bool(enabled() and age is not None and 0<=age<=maximum and not state.get("failed")),
            "completed_at":state.get("completed_at"),"metrics":state.get("metrics",{})})
    return result

class CommercialWorkerView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]
    def get(self,request,lane):
        key=os.environ.get("CRON_SECRET","")
        if len(key)<32 or not secrets.compare_digest(request.headers.get("Authorization","").encode(),("Bearer "+key).encode()):
            return Response({"detail":"Unauthorized."},status=401)
        if lane not in LANES:
            return Response({"detail":"Unknown worker."},status=404)
        if not enabled():
            return Response({"enabled":False},headers={"Cache-Control":"no-store"})
        try:
            token=claim(lane)
            if not token:
                return Response({"enabled":True,"state":"held"},headers={"Cache-Control":"no-store"})
            try:
                result=run_lane(lane)
            except Exception:
                finish(lane,token,{},failed=True)
                return Response({"enabled":True,"state":"failed"},status=503,headers={"Cache-Control":"no-store"})
            finish(lane,token,result)
            return Response({"enabled":True,"state":"completed",**result},headers={"Cache-Control":"no-store"})
        except DatabaseError:
            return Response({"enabled":True,"state":"held"},status=503,headers={"Cache-Control":"no-store"})
