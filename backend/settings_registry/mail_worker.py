"""Protected internal outbox worker. No public mail-send operation."""
import os
import secrets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class MailDeliveryCronView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]

    def get(self,request):
        key=os.environ.get("CRON_SECRET","")
        header=request.headers.get("Authorization","")
        if len(key)<32 or not secrets.compare_digest(header.encode(),("Bearer "+key).encode()):
            return Response({"detail":"Unauthorized."},status=401)
        from services.commercial_scheduler import enabled as commercial_enabled
        if commercial_enabled():
            return Response({"enabled":False,"state":"commercial_scheduler"},headers={"Cache-Control":"no-store"})
        from .mail_runtime import run_due_mail
        return Response(run_due_mail(2),headers={"Cache-Control":"no-store"})
