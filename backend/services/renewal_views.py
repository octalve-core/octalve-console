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
        from .hosting_lifecycle import run_due
        return Response({**renewals.run_due(),"lifecycle":run_due()},headers={"Cache-Control":"no-store"})

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
