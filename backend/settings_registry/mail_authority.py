"""Strict email personalization with no Jinja or user-controlled template evaluation."""
import html
import re
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from .models import EmailTemplate, ConsoleMailOutbox

TOKENS={
 "customer.first_name":"Customer","customer.full_name":"Customer Name",
 "invoice.number":"INV-2026-00001","invoice.due_date":"31 Oct 2026",
 "order.number":"ORD-2026-00001","domain.name":"example.com",
 "ticket.number":"TKT-1001","company.name":"Octalve Cloud","year":"2026",
 "service.label":"Starter Hosting","service.url":"https://console.example.test/client/services/1",
 "service.renewal_date":"31 Oct 2026",
}
PATTERN=re.compile(r"{{\s*([a-z][a-z0-9_.]*)\s*}}")
ANY_TOKEN=re.compile(r"{{|}}")
def validate_content(subject,body):
    if not isinstance(subject,str) or not 3<=len(subject)<=200 or "\n" in subject or "\r" in subject:
        raise ValueError("Subject must be a single line, 3–200 characters.")
    if not isinstance(body,str) or not 1<=len(body)<=12000:
        raise ValueError("Message must contain 1–12000 characters.")
    for text in (subject,body):
        tokens=set(PATTERN.findall(text))
        if tokens-set(TOKENS):
            raise ValueError("An unsupported personalization field was used.")
        if ANY_TOKEN.search(PATTERN.sub("",text)):
            raise ValueError("Personalization tags must use {{customer.first_name}} syntax.")
    return subject,body

def render(template,context):
    validate_content(template.subject,template.body_text)
    if not isinstance(context,dict) or set(context)-set(TOKENS):
        raise ValueError("Unsupported message variables.")
    def replace(match):
        key=match.group(1)
        if key not in context or not isinstance(context[key],str) or len(context[key])>255:
            raise ValueError("A required message field is unavailable.")
        return context[key]
    subject=PATTERN.sub(replace,template.subject)
    if "\r" in subject or "\n" in subject:
        raise ValueError("Message contains invalid header characters.")
    text=PATTERN.sub(replace,template.body_text)
    # Escaping the entire body ensures all user-supplied values remain text.
    content="<div style='white-space:pre-wrap'>"+html.escape(text,quote=True)+"</div>"
    return {"subject":subject,"body_text":text,"body_html":content}

def preview(template):
    # Only bounded synthetic fixtures, never an actual client's data.
    return render(template,TOKENS)

@transaction.atomic
def queue_templated_message(*,event_key,template_key,recipient,context,marketing_consent=False):
    """Internal only. No public queue endpoint, no automatic delivery claim."""
    if not isinstance(event_key,str) or not re.fullmatch(r"[a-zA-Z0-9:._-]{8,120}",event_key):
        raise ValueError("Invalid idempotency key.")
    try:
        validate_email(recipient)
    except DjangoValidationError:
        raise ValueError("Invalid recipient.") from None
    template=EmailTemplate.objects.filter(key=template_key,is_active=True).first()
    if template is None:
        raise ValueError("No active event template.")
    audience="marketing" if template.category=="marketing" else "transactional"
    if audience=="marketing" and not marketing_consent:
        raise ValueError("Marketing requires documented recipient consent.")
    rendered=render(template,context)
    outbox,created=ConsoleMailOutbox.objects.get_or_create(idempotency_key=event_key,defaults={
        "template":template,"recipient":recipient,"audience":audience,
        **rendered,
    })
    if not created and (outbox.template_id!=template.pk or outbox.recipient!=recipient):
        raise ValueError("Conflicting idempotency key.")
    if created and audience=="transactional":
        from services.commercial_scheduler import wake
        wake("mail")
    return outbox,created


def queue_invoice_issued(invoice):
    """Atomically record an invoice event if its approved template is active.

    Never permit an email configuration error to mutate an issued invoice or
    block checkout. No transport is called, and a failed enqueue is logged.
    """
    import logging
    from django.utils import timezone
    if not EmailTemplate.objects.filter(key="invoice_issued",is_active=True).exists():
        return False
    try:
        user=invoice.client
        name=(user.full_name or "").strip()
        due_date=invoice.due_date
        if timezone.is_naive(due_date):
            due_date=timezone.make_aware(due_date)
        context={
            "customer.first_name":name.split()[0] if name else "Customer",
            "customer.full_name":name or user.email,
            "invoice.number":str(invoice.invoice_number),
            "invoice.due_date":timezone.localtime(due_date).strftime("%d %b %Y"),
            "company.name":"Octalve Cloud",
            "year":str(timezone.now().year),
        }
        # Nested atomic block uses a savepoint when checkout already owns one.
        with transaction.atomic():
            _,created=queue_templated_message(
                event_key=f"invoice:{invoice.pk}:issued",
                template_key="invoice_issued",recipient=user.email,
                context=context
            )
        return created
    except (ValueError, DjangoValidationError):
        logging.getLogger(__name__).warning(
            "Active invoice email template rejected; delivery queued status unchanged",
            extra={"invoice_id":invoice.pk}
        )
        return False


def _transactional_event(event_key, template_key, user, context):
    """Only enqueue opt-in transactional templates; never call mail transport.

    A savepoint isolates rejected templates and mail database errors from the
    already verified financial or hosting transition. No historic replay.
    """
    import logging
    from django.db import DatabaseError
    from django.utils import timezone
    try:
        with transaction.atomic():
            if not EmailTemplate.objects.filter(
                    key=template_key, is_active=True,
                    category__in=("billing", "provisioning")).exists():
                return False
            name = (user.full_name or "").strip()
            _, created = queue_templated_message(
                event_key=event_key, template_key=template_key, recipient=user.email,
                context={"customer.first_name": name.split()[0] if name else "Customer",
                         "customer.full_name": name or user.email,
                         "company.name": "Octalve Cloud", "year": str(timezone.now().year),
                         **context})
            return created
    except (ValueError, DjangoValidationError, DatabaseError):
        logging.getLogger(__name__).warning("Verified transactional notice could not be queued",
            extra={"event_key": event_key})
        return False


def queue_payment_confirmed(invoice, payment):
    """One receipt event for independently verified live settlement only."""
    from provisioning.authority import evaluate_payment_to_provisioning
    from django.utils import timezone
    if not evaluate_payment_to_provisioning(invoice, payment).approved:
        return False
    return _transactional_event(f"invoice:{invoice.pk}:payment_confirmed",
        "payment_confirmed", invoice.client, {
            "invoice.number": str(invoice.invoice_number),
            "invoice.due_date": timezone.localtime(invoice.due_date).strftime("%d %b %Y"),
            "order.number": str(invoice.order.order_number),
        })


def queue_verified_hosting_notice(service):
    """Use the existing canonical mail outbox only after verified activation."""
    from django.conf import settings
    from notifications.hosting_ready import draft_hosting_ready, HostingNoticeRefused
    from django.utils import timezone
    if not getattr(settings, "CLOUD_HOSTING_READY_QUEUE_ENABLED", False):
        return False
    try:
        payload = draft_hosting_ready(service)
    except HostingNoticeRefused:
        return False
    actual = payload["service"]
    from notifications.hosting_ready import _console_origin
    return _transactional_event(payload["event_key"], "hosting_ready", actual.client, {
        "domain.name": actual.domain_name,
        "service.label": actual.label,
        "service.url": _console_origin() + f"/client/services/{actual.pk}",
        "service.renewal_date": timezone.localtime(actual.next_due_date).strftime("%d %b %Y"),
    })
