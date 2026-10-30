"""Public presentation token endpoint; no operator settings or provider details."""
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .console_policy import read_policy,MANIFEST

class ConsoleThemeView(APIView):
 permission_classes=[AllowAny]
 authentication_classes=[]
 def get(self,request):
  options={i["key"]:i["value"] for i in read_policy("theme")["fields"]}
  def safe(key):
   value=options[key]
   accepted=MANIFEST["theme"][key][1].split(":",1)[1].split(",")
   return value if value in accepted else MANIFEST["theme"][key][2]
  return Response({"primary_color":safe("primary_color"),
                   "canvas_color":safe("canvas_color"),
                   "density":safe("density")},
                  headers={"Cache-Control":"public, max-age=120"})
