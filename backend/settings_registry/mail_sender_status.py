"""Credential-free sender onboarding status; no network traffic or secret echo."""
from django.db.utils import OperationalError, ProgrammingError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .console_views import SuperAdminSettings
from .console_policy import read_policy
from providers.connection_specs import SCHEMAS
from providers.connection_models import IntegrationConnection

SENDER_GUIDES={
 "brevo":{
   "label":"Brevo",
   "guide":"https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC",
   "daily_free_quota":300,
 },
 "resend":{
   "label":"Resend",
   "guide":"https://resend.com/docs/dashboard/domains/introduction",
   "daily_free_quota":None,
 },
}
class MailSenderReadiness(APIView):
 permission_classes=[IsAuthenticated,SuperAdminSettings]
 def get(self,request):
  values={entry["key"]:entry["value"] for entry in read_policy("mail")["fields"]}
  rows=[]
  for key,guide in SENDER_GUIDES.items():
   # Draft records cannot send. Production credential writes are deliberately
   # unavailable until independent MFA and vault custody certification.
   try:
    drafts=IntegrationConnection.objects.filter(adapter_key=key,state="draft").count()
   except (OperationalError,ProgrammingError):
    drafts=0
   rows.append({"key":key,"label":guide["label"],
                "guide":guide["guide"],"draft_connections":drafts,
                "live_verified":False,"sending_enabled":False,
                "free_daily_quota":guide["daily_free_quota"],
                "registered":key in SCHEMAS})
  return Response({"primary":values["primary_sender"],"fallback":values["fallback_sender"],
    "senders":rows,"outbound_enabled":False,
    "status":"Credentials, sender-domain DNS, secure network, webhook receipts and suppression testing must be verified before sending.",
    "secret_entry_location":"Integration Store"},
    headers={"Cache-Control":"private, no-store"})
