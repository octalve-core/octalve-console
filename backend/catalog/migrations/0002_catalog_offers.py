# Generated for A1/A2 staging: review-only until a separately authorised release.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('catalog', '0001_initial'),
        ('providers', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CatalogOfferDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('payload', models.JSONField(default=dict)),
                ('status', models.CharField(max_length=20, default='draft', choices=[('draft', 'Draft'), ('published', 'Published'), ('superseded', 'Superseded')])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_cloud_offers', to=settings.AUTH_USER_MODEL)),
                ('plan', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='offer_drafts', to='catalog.plan')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='offer_drafts', to='catalog.product')),
                ('provider_package', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='offer_drafts', to='providers.providerpackage')),
            ],
            options={'ordering': ['-updated_at']},
        ),
        migrations.CreateModel(
            name='PublishedCatalogOffer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('revision', models.PositiveIntegerField()),
                ('snapshot', models.JSONField(default=dict)),
                ('published_at', models.DateTimeField(auto_now_add=True)),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='published_versions', to='catalog.plan')),
                ('published_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='published_cloud_offers', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-published_at'], 'unique_together': {('plan', 'revision')}},
        ),
    ]
