"""Create useful editable email templates without overwriting operator content."""
from django.db import migrations
TEMPLATES=[
 ("welcome","Welcome email","auth","Welcome to {{company.name}}","Hello {{customer.first_name}},\n\nWelcome to {{company.name}}. Your account is ready.\n\nThank you,\nOctalve Cloud"),
 ("order_received","Order received","billing","We received order {{order.number}}","Hello {{customer.first_name}},\n\nWe received your order {{order.number}}. You will receive another update when its status changes."),
 ("payment_confirmed","Payment confirmed","billing","Payment confirmation — {{invoice.number}}","Hello {{customer.first_name}},\n\nYour payment for invoice {{invoice.number}} was recorded. Thank you."),
 ("invoice_issued","New invoice","billing","Invoice {{invoice.number}} is ready","Hello {{customer.first_name}},\n\nYour invoice {{invoice.number}} is due on {{invoice.due_date}}."),
 ("invoice_due","Invoice reminder","billing","Reminder: {{invoice.number}} is due soon","Hello {{customer.first_name}},\n\nPlease review invoice {{invoice.number}} before {{invoice.due_date}}."),
 ("invoice_overdue","Overdue invoice notice","billing","Invoice {{invoice.number}} is overdue","Hello {{customer.first_name}},\n\nOur records show invoice {{invoice.number}} is overdue. Please review your account."),
 ("domain_expiry_month","Domain renewal — one month","domains","Renew your domain {{domain.name}}","Hello {{customer.first_name}},\n\nYour domain {{domain.name}} is approaching expiry. Review renewal options in your account."),
 ("domain_expiry_week","Domain renewal — one week","domains","Action needed: {{domain.name}}","Hello {{customer.first_name}},\n\nYour domain {{domain.name}} is due to expire soon. Review its status and renewal options."),
 ("support_ticket","Support ticket update","support","Support update — {{ticket.number}}","Hello {{customer.first_name}},\n\nThere is an update to your support ticket {{ticket.number}}."),
 ("hosting_ready","Hosting setup notice","provisioning","Your Octalve hosting is ready","Hello {{customer.first_name}},\n\nYour hosting setup has been verified. Sign in to review your services."),
 ("seasonal_greeting","Seasonal greeting","marketing","Greetings from {{company.name}}","Hello {{customer.first_name}},\n\nWarm greetings from our team. Thank you for choosing {{company.name}}."),
 ("promotion","Promotion announcement","marketing","An update from {{company.name}}","Hello {{customer.first_name}},\n\nWe have an update for customers who opted in to offers. Visit your account for details."),
]
def seed(apps,schema_editor):
    T=apps.get_model("settings_registry","EmailTemplate")
    for key,name,category,subject,body in TEMPLATES:
        T.objects.get_or_create(key=key,defaults={"name":name,"category":category,
            "description":"Editable transactional template" if category!="marketing" else "Requires marketing consent",
            "subject":subject,"body_text":body,"body_html":"",
            "is_active":False,"is_system":True})
class Migration(migrations.Migration):
    dependencies=[("settings_registry","0003_mail_template_outbox")]
    operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
