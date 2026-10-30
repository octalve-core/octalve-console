"""Seed only non-sensitive policy keys; do not overwrite existing operator values."""
from django.db import migrations

DEFAULTS={
 "general":[("company_name","Company name","Octalve Cloud"),("support_email","Support email","support@octalve.com"),("timezone","Display timezone","Africa/Lagos"),("default_language","Default language","en")],
 "theme":[("primary_color","Primary colour","#0064E0"),("canvas_color","Canvas colour","#F6F8FB"),("density","Interface density","comfortable")],
 "invoices":[("invoice_prefix","Invoice prefix","INV"),("invoice_footer","Invoice footer",""),("reminder_days","Reminder lead time","7"),("pdf_template","Invoice design","template_01")],
 "mail":[("sender_name","Sender name","Octalve Cloud"),("reply_to","Reply-to address","support@octalve.com")],
}
def seed(apps,schema_editor):
    Group=apps.get_model("settings_registry","SettingGroup")
    Setting=apps.get_model("settings_registry","Setting")
    for index,(group_key,entries) in enumerate(DEFAULTS.items()):
        group,_=Group.objects.get_or_create(key=group_key,defaults={"name":group_key.replace("_"," ").title(),"sort_order":index})
        for order,(key,label,value) in enumerate(entries):
            Setting.objects.get_or_create(group=group,key=key,defaults={
                "name":label,"data_type":"string","default_value":value,"value":value,
                "is_public":False,"sort_order":order
            })
class Migration(migrations.Migration):
    dependencies=[("settings_registry","0001_initial")]
    operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
