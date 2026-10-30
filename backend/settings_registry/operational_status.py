"""Read-only truthful operational state for Settings areas without verified editors."""
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .console_views import SuperAdminSettings
DATA={
 "security":("Access security",[
   ("Secure cookies","Browser session cookies use the verified deployment policy.","read_only"),
   ("CAPTCHA","No certified CAPTCHA adapter is available for activation here.","unconnected"),
   ("MFA step-up","Sensitive configuration grants require a separate certified MFA flow.","required"),
   ("Trusted proxies","Managed in deployment ingress, not editable through an API field.","managed"),
 ]),
 "social-login":("Social sign-in",[
   ("Google","OAuth connection and signed callback are not certified.","unconnected"),
   ("Apple","OAuth connection and signed callback are not certified.","unconnected"),
   ("Facebook","OAuth connection and signed callback are not certified.","unconnected"),
 ]),
 "api-keys":("API credential policy",[
   ("Supplier credentials","Connection secrets are owned by the Integration Store.","managed"),
   ("Octalve API tokens","Token issuance and revocation require a verified scoped token service.","unconnected"),
 ]),
 "providers":("Provider management",[
   ("Connections","Configure vendors and payment providers in Integrations.","managed"),
   ("Provisioning","Only approved, verified provider workers may execute tasks.","required"),
 ]),
 "credits":("Wallet policy",[
   ("Customer balances","Controlled by signed payment settlement and append-only ledger.","managed"),
   ("Manual funding","Unavailable without verified financial reconciliation.","unconnected"),
 ]),
 "cron-jobs":("Scheduled operations",[
   ("Renewals","Review approved due dates in billing operations.","managed"),
   ("Automatic processing","Requires a certified worker and retry/recovery authority.","unconnected"),
 ]),
 "tickets":("Support operations",[
   ("Support departments","Configure routing in the Support workspace.","managed"),
   ("Saved responses","Manage staff replies in the Support workspace.","managed"),
 ]),
 "other":("Advanced administration",[
   ("Runtime flags","Security-sensitive flags are managed by deployment configuration.","managed"),
 ]),
}
class ConsoleStatusView(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request,section):
  if section not in DATA:return Response({"detail":"No verified settings status."},status=404)
  heading,entries=DATA[section]
  return Response({"title":heading,"items":[{"name":name,"description":copy,"state":state} for name,copy,state in entries],
     "provider_certified":False,
     "note":"Only independently verified connections can be enabled."},
    headers={"Cache-Control":"private, no-store"})
