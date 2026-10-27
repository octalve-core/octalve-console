"""Initial, dormant rewards and affiliate ledgers. Apply only with vetted production preflight."""
import decimal
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import django.utils.timezone

class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("orders", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(name="RewardPolicy", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("name", models.CharField(max_length=100, default="O-Cloud Rewards")),
            ("is_active", models.BooleanField(default=False)),
            ("min_eligible_points", models.PositiveIntegerField(default=500)),
            ("points_per_ngn", models.PositiveIntegerField(default=1000)),
            ("max_discount_percent", models.DecimalField(max_digits=4, decimal_places=2,
                default=decimal.Decimal("5.00"), validators=[
                    django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(5)])),
            ("max_discount_ngn", models.DecimalField(max_digits=12, decimal_places=2,
                default=decimal.Decimal("2500.00"), validators=[django.core.validators.MinValueValidator(0)])),
            ("minimum_resale_margin_percent", models.DecimalField(max_digits=4, decimal_places=2,
                default=decimal.Decimal("20.00"), validators=[
                    django.core.validators.MinValueValidator(20), django.core.validators.MaxValueValidator(100)])),
            ("redemption_enabled", models.BooleanField(default=False)),
            ("updated_at", models.DateTimeField(auto_now=True)),
        ]),
        migrations.CreateModel(name="RewardTier", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("title", models.CharField(max_length=100)),
            ("required_points", models.PositiveIntegerField()),
            ("discount_percent", models.DecimalField(max_digits=4, decimal_places=2, validators=[
                django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(5)])),
            ("max_discount_ngn", models.DecimalField(max_digits=12, decimal_places=2, validators=[
                django.core.validators.MinValueValidator(0)])),
            ("enabled", models.BooleanField(default=False)),
            ("policy", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="tiers", to="rewards.rewardpolicy")),
        ], options={"constraints":[models.UniqueConstraint(fields=("policy","required_points"),
            name="reward_unique_tier_threshold")]}),
        migrations.CreateModel(name="AffiliateAccount", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("status", models.CharField(max_length=20, default="pending", choices=[
                ("pending","Pending review"),("approved","Approved"),("suspended","Suspended"),("rejected","Rejected")])),
            ("terms_version", models.CharField(max_length=30)),
            ("accepted_at", models.DateTimeField(default=django.utils.timezone.now)),
            ("reviewed_at", models.DateTimeField(null=True, blank=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("user", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT,
                related_name="affiliate", to=settings.AUTH_USER_MODEL)),
            ("reviewed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                null=True, blank=True, related_name="affiliate_reviews", to=settings.AUTH_USER_MODEL)),
        ]),
        migrations.CreateModel(name="ReferralAttribution", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("code_at_signup", models.CharField(max_length=50)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("referred_user", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT,
                related_name="signup_referral", to=settings.AUTH_USER_MODEL)),
            ("referrer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="attributed_signups", to=settings.AUTH_USER_MODEL)),
        ]),
        migrations.CreateModel(name="PointEntry", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("event_key", models.CharField(max_length=150, unique=True)),
            ("points_delta", models.IntegerField()),
            ("kind", models.CharField(max_length=24, choices=[
                ("purchase","Verified purchase"),("referral","Verified referral"),
                ("adjustment","Adjustment"),("redemption","Order redemption"),("reversal","Reversal")])),
            ("note", models.CharField(max_length=240, blank=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("order", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                blank=True, null=True, to="orders.order")),
            ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="reward_points", to=settings.AUTH_USER_MODEL)),
            ("approved_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                null=True, related_name="approved_point_events", to=settings.AUTH_USER_MODEL)),
        ], options={"indexes":[models.Index(fields=["user","-created_at"],name="reward_points_by_client")]}),
        migrations.CreateModel(name="CommissionEntry", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("event_key", models.CharField(max_length=150, unique=True)),
            ("amount_ngn", models.DecimalField(max_digits=12, decimal_places=2, validators=[
                django.core.validators.MinValueValidator(decimal.Decimal("0.01"))])),
            ("status", models.CharField(max_length=20, default="pending", choices=[
                ("pending","Pending"),("approved","Approved"),("reversed","Reversed"),("paid","Paid")])),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("affiliate", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="commissions", to="rewards.affiliateaccount")),
            ("approved_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                null=True, blank=True, related_name="approved_affiliate_commissions",to=settings.AUTH_USER_MODEL)),
            ("order", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,to="orders.order")),
        ]),
        migrations.CreateModel(name="ClientRecognition", fields=[
            ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
            ("title", models.CharField(max_length=120)),
            ("message", models.CharField(max_length=500)),
            ("category", models.CharField(max_length=30, default="appreciation")),
            ("published", models.BooleanField(default=False)),
            ("dismissed_at", models.DateTimeField(null=True, blank=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("approved_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="approved_recognitions", to=settings.AUTH_USER_MODEL)),
            ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                related_name="recognitions", to=settings.AUTH_USER_MODEL)),
        ]),
    ]
