"""Accounting separation: non-cash loyalty points versus monetary affiliate liabilities."""
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class RewardPolicy(models.Model):
    """Admin governance; discounts cannot be activated without checkout certification."""
    name = models.CharField(max_length=100, default="O-Cloud Rewards")
    is_active = models.BooleanField(default=False)
    min_eligible_points = models.PositiveIntegerField(default=500)
    points_per_ngn = models.PositiveIntegerField(default=1000)
    max_discount_percent = models.DecimalField(max_digits=4, decimal_places=2,
        default=Decimal("5.00"), validators=[MinValueValidator(0), MaxValueValidator(5)])
    max_discount_ngn = models.DecimalField(max_digits=12, decimal_places=2,
        default=Decimal("2500.00"), validators=[MinValueValidator(0)])
    minimum_resale_margin_percent = models.DecimalField(max_digits=4, decimal_places=2,
        default=Decimal("20.00"), validators=[MinValueValidator(20), MaxValueValidator(100)])
    redemption_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)


class RewardTier(models.Model):
    policy = models.ForeignKey(RewardPolicy, on_delete=models.PROTECT, related_name="tiers")
    title = models.CharField(max_length=100)
    required_points = models.PositiveIntegerField()
    discount_percent = models.DecimalField(max_digits=4, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(5)])
    max_discount_ngn = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)])
    enabled = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["policy", "required_points"], name="reward_unique_tier_threshold")
        ]


class PointEntry(models.Model):
    """Append-only and unique per verified source event; never a withdrawable wallet balance."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reward_points")
    event_key = models.CharField(max_length=150, unique=True)
    points_delta = models.IntegerField()
    kind = models.CharField(max_length=24, choices=[
        ("purchase", "Verified purchase"), ("referral", "Verified referral"),
        ("adjustment", "Adjustment"), ("redemption", "Order redemption"),
        ("reversal", "Reversal")])
    order = models.ForeignKey("orders.Order", null=True, blank=True, on_delete=models.PROTECT)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT,
        related_name="approved_point_events")
    note = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"], name="reward_points_by_client")]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("Points ledger is append-only; post a reversal.")
        if self.points_delta == 0:
            raise ValueError("Zero-point events are not allowed.")
        super().save(*args, **kwargs)


class AffiliateAccount(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="affiliate")
    status = models.CharField(max_length=20, default="pending", choices=[
        ("pending", "Pending review"), ("approved", "Approved"),
        ("suspended", "Suspended"), ("rejected", "Rejected")])
    terms_version = models.CharField(max_length=30)
    accepted_at = models.DateTimeField(default=timezone.now)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="affiliate_reviews")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ReferralAttribution(models.Model):
    """Only the signup code chosen by the registering user; no hidden visitor tracking."""
    referrer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="attributed_signups")
    referred_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="signup_referral")
    code_at_signup = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)


class CommissionEntry(models.Model):
    """Payable affiliate amounts NEVER share a wallet or points ledger."""
    affiliate = models.ForeignKey(AffiliateAccount, on_delete=models.PROTECT, related_name="commissions")
    event_key = models.CharField(max_length=150, unique=True)
    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT)
    amount_ngn = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))])
    status = models.CharField(max_length=20, default="pending", choices=[
        ("pending", "Pending"), ("approved", "Approved"), ("reversed", "Reversed"),
        ("paid", "Paid")])
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="approved_affiliate_commissions")
    created_at = models.DateTimeField(auto_now_add=True)


class ClientRecognition(models.Model):
    """Private customer-first appreciation. Never a default public ranked leaderboard."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recognitions")
    title = models.CharField(max_length=120)
    message = models.CharField(max_length=500)
    category = models.CharField(max_length=30, default="appreciation")
    published = models.BooleanField(default=False)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="approved_recognitions")
    created_at = models.DateTimeField(auto_now_add=True)
