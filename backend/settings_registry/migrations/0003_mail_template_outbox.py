"""Additive mail version and delivery-intent schema. No sending or data rewrites."""
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):
 dependencies=[("settings_registry","0002_console_policy_defaults")]
 operations=[
  migrations.CreateModel(name="EmailTemplateRevision",fields=[
   ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False)),
   ("revision",models.PositiveIntegerField()),
   ("snapshot",models.JSONField(default=dict)),
   ("created_at",models.DateTimeField(auto_now_add=True)),
   ("actor",models.ForeignKey(to=settings.AUTH_USER_MODEL,on_delete=django.db.models.deletion.SET_NULL,null=True,blank=True)),
   ("template",models.ForeignKey(to="settings_registry.emailtemplate",on_delete=django.db.models.deletion.PROTECT,related_name="revisions")),
  ]),
  migrations.CreateModel(name="ConsoleMailOutbox",fields=[
   ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False)),
   ("idempotency_key",models.CharField(max_length=128,unique=True)),
   ("recipient",models.EmailField(max_length=254)),
   ("subject",models.CharField(max_length=255)),
   ("body_text",models.TextField()),
   ("body_html",models.TextField()),
   ("audience",models.CharField(max_length=16,choices=[("transactional","Transactional"),("marketing","Marketing")])),
   ("status",models.CharField(max_length=24,default="queued",choices=[("queued","Queued"),("processing","Processing"),("sent","Sent"),("needs_review","Needs delivery reconciliation"),("failed","Failed"),("suppressed","Suppressed")])),
   ("attempts",models.PositiveIntegerField(default=0)),
   ("provider",models.CharField(max_length=80,blank=True,default="")),
   ("provider_receipt",models.CharField(max_length=255,blank=True,default="")),
   ("last_error_code",models.CharField(max_length=80,blank=True,default="")),
   ("next_attempt_at",models.DateTimeField(null=True,blank=True)),
   ("sent_at",models.DateTimeField(null=True,blank=True)),
   ("created_at",models.DateTimeField(auto_now_add=True)),
   ("template",models.ForeignKey(to="settings_registry.emailtemplate",on_delete=django.db.models.deletion.PROTECT)),
  ],options={"indexes":[models.Index(fields=["status","created_at"],name="console_mail_state_ix")]}),
  migrations.CreateModel(name="ConsoleMailAttempt",fields=[
   ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False)),
   ("provider",models.CharField(max_length=80)),
   ("outcome",models.CharField(max_length=24,choices=[("accepted","Accepted"),("refused","Refused"),("unknown","Unknown")])),
   ("receipt",models.CharField(max_length=255,blank=True,default="")),
   ("created_at",models.DateTimeField(auto_now_add=True)),
   ("outbox",models.ForeignKey(to="settings_registry.consolemailoutbox",on_delete=django.db.models.deletion.PROTECT,related_name="delivery_attempts")),
  ]),
  migrations.AddConstraint(model_name="emailtemplaterevision",constraint=models.UniqueConstraint(fields=["template","revision"],name="email_template_revision_uniq")),
 ]
