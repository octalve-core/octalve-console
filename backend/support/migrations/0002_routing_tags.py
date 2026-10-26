from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("support","0001_initial"),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="SupportRoutingTag",fields=[
            ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),
            ("slug",models.SlugField(max_length=40)),
            ("label",models.CharField(max_length=80)),
            ("is_active",models.BooleanField(default=True)),
            ("department",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="routing_tags",to="support.supportdepartment")),
            ("assigned_staff",models.ManyToManyField(blank=True,limit_choices_to={"role__in":["admin","staff"]},
                related_name="support_routing_tags",to=settings.AUTH_USER_MODEL)),
        ],options={"ordering":["department_id","label"]}),
        migrations.AddField(model_name="supportticket",name="routing_tag",
            field=models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,
                related_name="tickets",to="support.supportroutingtag")),
        migrations.AddConstraint(model_name="supportroutingtag",
            constraint=models.UniqueConstraint(fields=("department","slug"),name="unique_support_routing_tag")),
    ]
