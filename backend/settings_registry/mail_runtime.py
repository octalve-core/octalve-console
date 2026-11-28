"""MFA-approved, vault-bound mail authority and durable transactional delivery.

No provider secrets are copied into settings. Only proven business events
may be delivered, and any uncertain acceptance stays in the existing outbox.
"""
import hashlib
import hmac
import json
import re
from datetime import timedelta
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import DatabaseError, transaction
from django.db.models import Q
from django.utils import timezone
from audit.models import AuditLog
from billing.models import Invoice
from payments.models import Transaction
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_vault import unseal_version, VaultUnavailable
from providers.connection_audit import verify_chain, audit_keyring
from providers.connection_views import connection_database_qualified
from providers.connection_specs import validate_public_settings, validate_secrets
from providers.hosting_runtime import qualified_vault
from services.models import Service
from opanel_bridge.policy import eligible, refresh_candidate
from .models import ConsoleMailOutbox
from .console_policy import read_policy
from .mail_dispatch import DeliveryResult, deliver_queued_once, quarantine_expired_attempts
from .brevo_transport import verify_sender, send_message, SenderRefused
from . import resend_transport

def _transport(adapter):
    if adapter=="brevo":
        return verify_sender,send_message
    if adapter=="resend":
        return resend_transport.verify_sender,resend_transport.send_message
    raise SenderRefused("Unsupported sender.")

ACTION = "mail_sender_policy_v1"
ADAPTER = "brevo"
KEYS = ("payment_confirmed", "hosting_ready", "invoice_due", "hosting_cancellation_notice", "hosting_termination_notice")
ID_PATTERN = re.compile(r"(?:invoice:([1-9][0-9]{0,18}):payment_confirmed|hosting_ready:v1:([1-9][0-9]{0,18}))\Z")


def enabled():
    return bool(getattr(settings,"CLOUD_TRANSACTIONAL_MAIL_ENABLED",False)
                and qualified_vault())


def _identity(row):
    return {"connection":str(row.pk),"version":row.current_version,
            "adapter":row.adapter_key,"environment":row.environment,
            "public_settings":row.public_settings,"audit_head":row.audit_head,
            "updated_at":row.updated_at.isoformat()}


def _digest(payload,key):
    return hmac.new(key,b"octalve-transactional-mail-policy-v1\0"+
        json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),
        hashlib.sha256).hexdigest()


def _mail_settings():
    return {item["key"]:item["value"] for item in read_policy("mail")["fields"]}


def _approved_address(address):
    try:
        if (not isinstance(address,str) or not 3<=len(address)<=254
                or any(ord(c)<33 or ord(c)>126 for c in address)):
            raise ValueError()
        validate_email(address)
        return address
    except (ValueError,ValidationError):
        raise SenderRefused("Invalid sender address.") from None


def _key(row):
    if (row.adapter_key not in ("brevo","resend") or row.environment!="live" or row.state!="draft"
            or not qualified_vault()):
        raise VaultUnavailable()
    try:
        validate_public_settings(row.adapter_key,row.public_settings)
        verify_chain(row)
        version=IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row,version=row.current_version,revoked_at__isnull=True)
        if (_identity(version.connection)!=_identity(row)
                or version.connection.state!="draft"):
            raise VaultUnavailable()
        return validate_secrets(row.adapter_key,unseal_version(version),row.environment)["api_key"]
    except (IntegrationCredentialVersion.DoesNotExist,KeyError,ValueError):
        raise VaultUnavailable() from None


def configure(row_id,sender,actor):
    """Called after the existing super-admin password/authenticator check."""
    sender=_approved_address(sender)
    row=IntegrationConnection.objects.get(pk=row_id)
    key=_key(row)
    identity=_identity(row)
    domain=row.public_settings["sending_domain"]
    mail=_mail_settings()
    name=mail["sender_name"]
    reply=_approved_address(mail["reply_to"])
    if (not isinstance(name,str) or not 2<=len(name)<=100
            or any(ord(c)<32 or ord(c)==127 for c in name)):
        raise SenderRefused("Invalid sender name.")
    _transport(row.adapter_key)[0](domain,sender,key)
    with transaction.atomic():
        current=IntegrationConnection.objects.select_for_update().get(pk=row.pk)
        if _identity(current)!=identity or _key(current)!=key or _mail_settings()!=mail:
            raise VaultUnavailable()
        # Advance revision to invalidate any older signed approval, even
        # if a newer audit record were subsequently removed.
        current.save(update_fields=["updated_at"])
        payload={**_identity(current),"sender":sender,"sender_name":name,"reply_to":reply}
        active,keys=audit_keyring()
        AuditLog.objects.create(actor=actor,action=ACTION,entity_type="IntegrationConnection",
            entity_id=str(current.pk),entity_name=row.adapter_key,
            details={"payload":payload,"key_id":active,"mac":_digest(payload,keys[active])})
        AuditLog.objects.create(actor=actor,action="provider_connection_test",
            entity_type="IntegrationConnection",entity_id=str(current.pk),entity_name=row.adapter_key,
            details={"adapter":row.adapter_key,"credential_version":current.current_version,
                     "verified":True,"read_only":True,"execution_enabled":False,
                     "checked_at":timezone.now().isoformat()})
    return {"configured":True,"delivery_enabled":enabled()}


def approved_policy(row):
    """Validate a current signed approval; unsigned UI evidence never authorizes mail."""
    record=AuditLog.objects.filter(action=ACTION,entity_type="IntegrationConnection",
        entity_id=str(row.pk),entity_name=row.adapter_key).order_by("-pk").first()
    if record is None:
        raise SenderRefused("No sender approval.")
    try:
        grant=record.details
        payload=grant["payload"]
        _,keys=audit_keyring()
        if (not hmac.compare_digest(grant["mac"],_digest(payload,keys[grant["key_id"]]))
                or any(payload.get(k)!=v for k,v in _identity(row).items())
                or set(payload)!=set(_identity(row))|{"sender","sender_name","reply_to"}
                or row.state!="draft" or row.environment!="live" or row.adapter_key not in ("brevo","resend")):
            raise SenderRefused("Sender approval is no longer current.")
        _approved_address(payload["sender"])
        _approved_address(payload["reply_to"])
        if payload["sender"].rpartition("@")[2].lower()!=row.public_settings["sending_domain"]:
            raise SenderRefused("Sender domain changed.")
        return payload
    except (KeyError,TypeError,ValueError,VaultUnavailable):
        raise SenderRefused("Sender approval is unavailable.") from None


def current_message(message):
    """Do not send test receipts, changed recipients or unverified services."""
    if (message.audience!="transactional" or not message.template.is_active
            or message.template.key not in KEYS):
        return False
    if message.template.key in ("hosting_cancellation_notice","hosting_termination_notice"):
        from services.hosting_cancellation import current_notice
        return current_notice(message)
    renewal=re.fullmatch(r"invoice:([1-9][0-9]{0,18}):renewal_reminder",message.idempotency_key)
    if renewal:
        invoice=Invoice.objects.select_related("client","order").filter(pk=int(renewal[1]),metadata__has_key="hosting_renewal_v1").first()
        if not invoice or not invoice.client.is_active or invoice.client.email!=message.recipient:
            return False
        from services.renewals import reminder_context
        return message.template.key=="invoice_due" and reminder_context(invoice) is not None
    match=ID_PATTERN.fullmatch(message.idempotency_key)
    if not match:
        return False
    if match[1] and message.template.key=="payment_confirmed":
        invoice=Invoice.objects.select_related("client","order").filter(pk=int(match[1])).first()
        if (not invoice or not invoice.order_id or invoice.status!="paid"
                or not invoice.client.is_active or invoice.client.email!=message.recipient
                or invoice.order.client_id!=invoice.client_id
                or invoice.order.status not in ("paid","provisioned")
                or invoice.amount_due!=0 or invoice.amount_paid!=invoice.total
                or invoice.total<=0 or invoice.order.total!=invoice.total
                or invoice.order.currency!=invoice.currency):
            return False
        rows=list(Transaction.objects.select_related("gateway").filter(
            invoice=invoice,status="successful",transaction_type="payment")[:2])
        if len(rows)!=1:
            return False
        payment=rows[0]
        evidence=payment.metadata
        return bool(payment.gateway and payment.gateway.status=="active" and not payment.gateway.test_mode
            and payment.gateway.code in ("paystack","flutterwave")
            and payment.client_id==invoice.client_id and payment.amount==invoice.total
            and payment.currency==invoice.currency and payment.paid_at
            and invoice.paid_at and invoice.order.paid_at
            and isinstance(evidence,dict)
            and ((evidence.get("verification_source")=="provider_api_verified"
                  and evidence.get("provider_api_verified") is True and payment.provider_reference
                  and evidence.get("verified_remote_id")==payment.provider_reference)
                 or (evidence.get("verification_source")=="signed_webhook_and_api_verification"
                     and payment.webhook_verified)))
    if match[2] and message.template.key=="hosting_ready":
        service=Service.objects.select_related("client").filter(pk=int(match[2])).first()
        return bool(service and service.client.is_active and service.client.email==message.recipient
            and (eligible(service.client_id,service.pk) or refresh_candidate(service.client_id,service.pk)))
    return False


class BrevoSender:
    name=ADAPTER
    certified=True

    def __init__(self,row,policy):
        self.name=row.adapter_key
        self.row_id=row.pk
        self.policy=policy

    def send(self,**message):
        """Recheck revocation, message ownership and sender identity before POST."""
        try:
            if not enabled():
                raise SenderRefused("Delivery disabled.")
            row=IntegrationConnection.objects.get(pk=self.row_id)
            policy=approved_policy(row)
            if policy!=self.policy:
                raise SenderRefused("Mail approval changed.")
            key=_key(row)
            stored=ConsoleMailOutbox.objects.select_related("template").get(
                idempotency_key=message["idempotency_key"],status="processing")
            if (not current_message(stored) or any(getattr(stored,k)!=message[k]
                    for k in ("recipient","subject","body_text","body_html"))):
                raise SenderRefused("Notice authority changed.")
            _transport(row.adapter_key)[0](row.public_settings["sending_domain"],policy["sender"],key)
            latest=IntegrationConnection.objects.get(pk=self.row_id)
            if _identity(latest)!=_identity(row) or approved_policy(latest)!=policy or _key(latest)!=key:
                raise SenderRefused("Sender changed during verification.")
            stored.refresh_from_db()
            if stored.status!="processing" or not current_message(stored) or any(
                getattr(stored,k)!=message[k] for k in ("recipient","subject","body_text","body_html")):
                raise SenderRefused("Notice changed during verification.")
        except (IntegrationConnection.DoesNotExist,ConsoleMailOutbox.DoesNotExist,
                SenderRefused,VaultUnavailable,DatabaseError,KeyError):
            # No POST happened. The outbox may safely record refusal.
            return DeliveryResult("refused",error_code="sender_or_notice_not_authorized")
        return _transport(row.adapter_key)[1](key=key,sender=policy["sender"],sender_name=policy["sender_name"],
                            reply_to=policy["reply_to"],**message)


def configured_sender(adapter=ADAPTER):
    """No arbitrary connection selection: ambiguity holds rather than guessing."""
    mail=_mail_settings()
    if adapter not in ("brevo","resend") or adapter not in (mail["primary_sender"],mail["fallback_sender"]):
        return None
    candidates=[]
    for row in IntegrationConnection.objects.filter(adapter_key=adapter,
            environment="live",state="draft").order_by("pk")[:51]:
        try:
            candidates.append((row,approved_policy(row)))
        except SenderRefused:
            continue
        if len(candidates)>1:
            return None
    if IntegrationConnection.objects.filter(adapter_key=adapter,environment="live",
            state="draft").count()>50 or len(candidates)!=1:
        return None
    return BrevoSender(*candidates[0])


def run_due_mail(limit=2):
    """Bounded queue worker; no browser-selected recipient or message."""
    result={"enabled":enabled(),"accepted":0,"held":0,"quarantined":0}
    if not result["enabled"]:
        return result
    result["quarantined"]=quarantine_expired_attempts(limit=20)
    mail=_mail_settings()
    sender=configured_sender(mail["primary_sender"])
    # Fallback is only attempted after a verified primary definitively refuses.
    if sender is None:
        return result
    fallback=configured_sender(mail["fallback_sender"])
    senders=[sender]+([fallback] if fallback and fallback.name!=sender.name else [])
    now=timezone.now()
    ids=list(ConsoleMailOutbox.objects.filter(status="queued",audience="transactional",
        template__key__in=KEYS,template__is_active=True,created_at__gte=now-timedelta(days=7))
        .filter(Q(next_attempt_at__isnull=True)|Q(next_attempt_at__lte=now))
        .order_by("created_at","pk").values_list("pk",flat=True)[:min(max(limit,1),2)])
    for pk in ids:
        if deliver_queued_once(pk,senders=senders):
            result["accepted"]+=1
        else:
            result["held"]+=1
    return result
