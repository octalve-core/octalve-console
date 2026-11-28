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
# The Linux runner kills each child after 240 seconds. HTTP runtimes may
# allow up to 1800 seconds; keep their recovery lease beyond that bound.
HTTP_LEASE=timedelta(minutes=35)
INTERVALS={"payments":300,"staging":300,"provisioning":300,"mail":300,
           "renewals":3600,"lifecycle":1800,"cancellation":3600}
CHANNEL="octalve_commercial_wakeup"

def wake(lane):
    """Best-effort signal only; persisted business records remain the queue."""
    if lane not in LANES or not enabled() or connection.vendor!="postgresql":
        return
    def send():
        try:
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute("SELECT pg_notify(%s,%s)",[CHANNEL,lane])
        except DatabaseError:
            # Periodic recovery is authoritative even if a signal is lost.
            pass
    transaction.on_commit(send,robust=True)


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
def claim(lane, *, http=False):
    if not enabled() or lane not in LANES or connection.vendor!="postgresql":
        return None
    # Transaction-scoped lock works with transaction-pooling connections.
    number=int.from_bytes(sha256((PREFIX+lane).encode()).digest()[:8],"big",signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_xact_lock(%s)",[number])
        if not cursor.fetchone()[0]:
            return None
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
    state.update(lease=token,lease_until=(now+(HTTP_LEASE if http else LEASE)).isoformat(),started_at=now.isoformat())
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
        maximum=2*INTERVALS[lane]+300
        result.append({"lane":lane,"healthy":bool(enabled() and age is not None and 0<=age<=maximum and not state.get("failed")),
            "completed_at":state.get("completed_at"),"metrics":state.get("metrics",{})})
    return result

def execute(lane, *, http=False):
    """Same authorization-preserving lane runner for HTTP and Linux."""
    if lane not in LANES:
        raise ValueError("Unknown worker lane.")
    if not enabled():
        return {"enabled":False}
    token=claim(lane,http=http)
    if not token:
        return {"enabled":True,"state":"held"}
    try:
        result=run_lane(lane)
    except Exception:
        finish(lane,token,{},failed=True)
        return {"enabled":True,"state":"failed"}
    finish(lane,token,result)
    return {"enabled":True,"state":"completed",**result}

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
            result=execute(lane,http=True)
            return Response(result,status=503 if result.get("state")=="failed" else 200,headers={"Cache-Control":"no-store"})
        except DatabaseError:
            return Response({"enabled":True,"state":"held"},status=503,headers={"Cache-Control":"no-store"})
