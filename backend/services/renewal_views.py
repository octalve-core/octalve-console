"""Owner-approved renewal settings and authenticated bounded worker."""
import os
import secrets
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.response import Response
from providers.connection_stepup import assert_admin,check_mutation
from providers.connection_views import VaultMutationThrottle
from providers.connection_vault import VaultUnavailable
from . import renewals

HEADERS={"Cache-Control":"private, no-store"}

class RenewalPolicyView(APIView):
    permission_classes=[IsAuthenticated]
    throttle_classes=[VaultMutationThrottle]
    def get(self,request):
        assert_admin(request.user)
        try:
            return Response({"available":renewals.enabled(),"policy":renewals.policy()},headers=HEADERS)
        except (renewals.RenewalRefused,VaultUnavailable):
            return Response({"available":False,"policy":None},headers=HEADERS)
    def post(self,request):
        assert_admin(request.user)
        if not renewals.enabled():
            return Response({"detail":"Renewal authority is disabled."},status=503,headers=HEADERS)
        data=request.data
        if not isinstance(data,dict) or set(data)!={"policy","confirm_password","totp_code"}:
            return Response({"detail":"Invalid policy confirmation."},status=400,headers=HEADERS)
        try:
            value=renewals.validate_policy(data["policy"])
            check_mutation(request.user,data["confirm_password"],data["totp_code"])
            return Response({"available":True,"policy":renewals.save_policy(value,request.user)},headers=HEADERS)
        except (renewals.RenewalRefused,VaultUnavailable):
            return Response({"detail":"Renewal policy could not be approved."},status=409,headers=HEADERS)

class RenewalCronView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]
    def get(self,request):
        key=os.environ.get("CRON_SECRET","")
        if len(key)<32 or not secrets.compare_digest(request.headers.get("Authorization","").encode(),("Bearer "+key).encode()):
            return Response({"detail":"Unauthorized."},status=401)
        from .commercial_scheduler import enabled as commercial_enabled
        if commercial_enabled():
            return Response({"enabled":False,"state":"commercial_scheduler"},headers={"Cache-Control":"no-store"})
        from .hosting_lifecycle import run_due
        from .hosting_cancellation import run_due as cancellation_due
        return Response({**renewals.run_due(),"lifecycle":run_due(),"cancellation":cancellation_due()},headers={"Cache-Control":"no-store"})

class LifecyclePolicyView(APIView):
    permission_classes=[IsAuthenticated]
    throttle_classes=[VaultMutationThrottle]
    def get(self,request):
        assert_admin(request.user)
        from . import hosting_lifecycle as lifecycle
        try:
            return Response({"available":lifecycle.enabled(),"policy":lifecycle.policy()},headers=HEADERS)
        except (renewals.RenewalRefused,VaultUnavailable):
            return Response({"available":False,"policy":None},headers=HEADERS)
    def post(self,request):
        assert_admin(request.user)
        from . import hosting_lifecycle as lifecycle
        if not lifecycle.enabled():
            return Response({"detail":"Lifecycle authority is disabled."},status=503,headers=HEADERS)
        data=request.data
        if not isinstance(data,dict) or set(data)!={"policy","confirm_password","totp_code"}:
            return Response({"detail":"Invalid policy confirmation."},status=400,headers=HEADERS)
        try:
            value=lifecycle.validate_policy(data["policy"])
            check_mutation(request.user,data["confirm_password"],data["totp_code"])
            return Response({"available":True,"policy":lifecycle.save_policy(value,request.user)},headers=HEADERS)
        except (renewals.RenewalRefused,VaultUnavailable):
            return Response({"detail":"Lifecycle policy could not be approved."},status=409,headers=HEADERS)


class CancellationPolicyView(APIView):
    permission_classes=[IsAuthenticated]
    throttle_classes=[VaultMutationThrottle]
    def get(self,request):
        assert_admin(request.user)
        from . import hosting_cancellation as cancel
        from .models import ServiceActionLog,Service
        try:
            pending=list(ServiceActionLog.objects.filter(action="cancel",details__state="pending_review").order_by("pk").values("pk","service_id","service__domain_name","service__next_due_date")[:50])
            retained=list(Service.objects.filter(status="cancelled",metadata__hosting_cancellation_v1__state="retained").order_by("pk").values("pk","domain_name","cancelled_at")[:50])
            return Response({"available":cancel.enabled(),"policy":cancel.policy(),"pending":pending,"retained":retained},headers=HEADERS)
        except (renewals.RenewalRefused,VaultUnavailable):
            return Response({"available":False,"policy":None,"pending":[],"retained":[]},headers=HEADERS)
    def post(self,request):
        assert_admin(request.user)
        from . import hosting_cancellation as cancel
        from .models import Service,ServiceActionLog
        if not cancel.enabled():
            return Response({"detail":"Cancellation disabled."},status=503,headers=HEADERS)
        data=request.data
        if not isinstance(data,dict) or not {"action","confirm_password","totp_code"}<=set(data):
            return Response({"detail":"Invalid confirmation."},status=400,headers=HEADERS)
        action=data["action"]
        try:
            check_mutation(request.user,data["confirm_password"],data["totp_code"])
            common={"action","confirm_password","totp_code"}
            if action=="policy" and set(data)==common|{"policy"}:
                return Response({"policy":cancel.save_policy(data["policy"],request.user)},headers=HEADERS)
            if action=="approve" and set(data)==common|{"service_id","request_id"} and type(data["service_id"]) is int and type(data["request_id"]) is int:
                return Response(cancel.approve(data["service_id"],data["request_id"],request.user),headers=HEADERS)
            if action=="terminate" and set(data)==common|{"service_id","confirmed_domain","backup_reference"} and type(data["service_id"]) is int:
                return Response(cancel.authorize_removal(data["service_id"],request.user,data["confirmed_domain"],data["backup_reference"]),headers=HEADERS)
        except (renewals.RenewalRefused,VaultUnavailable,ValueError,TypeError,KeyError,Service.DoesNotExist,ServiceActionLog.DoesNotExist):
            return Response({"detail":"Cancellation authority not confirmed."},status=409,headers=HEADERS)
        return Response({"detail":"Unsupported cancellation action."},status=400,headers=HEADERS)
