"""Owner-only, audited settings endpoints. Mutations cannot run through generic serializers."""
from rest_framework.views import APIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .console_policy import read_policy, save_policy, MANIFEST

class SuperAdminSettings(BasePermission):
    def has_permission(self, request, view):
        u=request.user
        return bool(u and u.is_authenticated and u.is_active and
            u.is_staff and u.is_superuser and getattr(u,"role",None)=="admin")

class ConsolePolicyView(APIView):
    permission_classes=[IsAuthenticated,SuperAdminSettings]
    def get(self,request,section):
        if section not in MANIFEST:
            return Response({"detail":"Unknown settings section."},status=404)
        return Response(read_policy(section),headers={"Cache-Control":"private, no-store"})
    def patch(self,request,section):
        if section not in MANIFEST:
            return Response({"detail":"Unknown settings section."},status=404)
        try:
            outcome=save_policy(section,request.data,request.user,
                request.META.get("REMOTE_ADDR"))
        except ValueError as exc:
            return Response({"detail":str(exc)},status=400)
        except RuntimeError as exc:
            return Response({"detail":str(exc)},status=409)
        return Response(outcome,headers={"Cache-Control":"private, no-store"})
