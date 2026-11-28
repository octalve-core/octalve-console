"""Authenticated internal scheduling endpoint, no customer-controlled task IDs."""
import os
import secrets
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .automatic_staging import enabled,run_due_staging

class HostingStagingCronView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]

    def get(self,request):
        key=os.environ.get("CRON_SECRET","")
        header=request.headers.get("Authorization","")
        if len(key)<32 or not secrets.compare_digest(header.encode(),("Bearer "+key).encode()):
            return Response({"detail":"Unauthorized."},status=401)
        if not enabled():
            return Response({"detail":"Hosting staging disabled."},status=503)
        return Response(run_due_staging(),headers={"Cache-Control":"no-store"})
