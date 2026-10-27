"""Rewards are OFF unless migrated and explicitly enabled.

A points balance is *not* cash; preview never changes invoice totals.
Commissions are financial liabilities, never silently paid. Admin authorization
and verified live settlement are required for each grant.
"""
from decimal import Decimal, ROUND_DOWN
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from billing.models import Invoice
from payments.models import Transaction
from .models import (
    RewardPolicy, RewardTier, PointEntry, AffiliateAccount,
    ReferralAttribution, CommissionEntry, ClientRecognition,
)

TERMS_VERSION = "ocloud-affiliate-2026-10"
User = get_user_model()

def _gate(request, admin=False):
    if not request.user.is_authenticated or not request.user.is_active:
        return Response({"detail":"Unauthorized."}, status=403)
    if not getattr(settings, "REWARDS_API_ENABLED", False):
        return Response({"detail":"Rewards programme is being prepared."}, status=503)
    if admin:
        if not (request.user.is_superuser and request.user.is_staff and request.user.role=="admin"):
            return Response({"detail":"Unavailable."}, status=404)
    elif request.user.role!="client":
        return Response({"detail":"Unavailable."}, status=404)
    return None

def _policy():
    return RewardPolicy.objects.order_by("pk").first()

def _balance(user):
    return PointEntry.objects.filter(user=user).aggregate(total=Sum("points_delta"))["total"] or 0

def _tier_data(policy, points):
    if not policy or not policy.is_active or points < policy.min_eligible_points:
        return None
    tier = (RewardTier.objects.filter(policy=policy,enabled=True,
       required_points__lte=points).order_by("-required_points","pk").first())
    if not tier:
        return None
    # Eligibility preview only. At checkout calculate supplier cost from an
    # approved published offer, plus fees, taxes, and an enforceable margin.
    return {
        "title":tier.title,
        "required_points":tier.required_points,
        "discount_percent":str(min(tier.discount_percent,policy.max_discount_percent,Decimal("5.00"))),
        "max_discount_ngn":str(min(tier.max_discount_ngn,policy.max_discount_ngn)),
        "redemption_available":False,
        "explanation":"Discount can only be activated after checkout's cost-and-margin verification.",
    }

class MyRewards(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        denied=_gate(request)
        if denied:return denied
        user=request.user
        account=AffiliateAccount.objects.filter(user=user).first()
        earned=PointEntry.objects.filter(user=user,points_delta__gt=0).aggregate(v=Sum("points_delta"))["v"] or 0
        spent=PointEntry.objects.filter(user=user,points_delta__lt=0).aggregate(v=Sum("points_delta"))["v"] or 0
        points=max(_balance(user),0)
        policy=_policy()
        commissions=CommissionEntry.objects.filter(affiliate=account) if account else CommissionEntry.objects.none()
        totals={status:str(commissions.filter(status=status).aggregate(v=Sum("amount_ngn"))["v"] or Decimal("0"))
                for status in ("pending","approved","paid","reversed")}
        recognition=ClientRecognition.objects.filter(user=user,published=True,dismissed_at__isnull=True).order_by("-created_at")[:5]
        return Response({
            "points":{"balance":points,"earned":earned,"spent":abs(spent),
                      "redeemable_cash":"0.00","currency":"NGN"},
            "offer":_tier_data(policy,points),
            "programme_enabled":bool(policy and policy.is_active),
            "affiliate":{"status":account.status if account else "not_applied",
                         "terms_version":TERMS_VERSION,
                         "referral_code":user.referral_code if account else None,
                         "attributed_signups":ReferralAttribution.objects.filter(referrer=user).count(),
                         "commissions_ngn":totals,
                         "commission_payout_enabled":False},
            "recognition":[{"id":r.pk,"title":r.title,"message":r.message,
                            "category":r.category} for r in recognition],
        },headers={"Cache-Control":"private, no-store"})

class AffiliateApply(APIView):
    permission_classes=[IsAuthenticated]
    def post(self,request):
        denied=_gate(request)
        if denied:return denied
        if request.data.get("accept_terms") is not True or request.data.get("terms_version")!=TERMS_VERSION:
            return Response({"detail":"Accept the current affiliate terms to apply."},status=400)
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            account,created=AffiliateAccount.objects.get_or_create(user_id=request.user.pk,
                defaults={"terms_version":TERMS_VERSION})
        return Response({"status":account.status,"terms_version":account.terms_version,
                         "referral_code":request.user.referral_code,
                         "commission_payout_enabled":False},status=201 if created else 200)

class RecognitionDismiss(APIView):
    permission_classes=[IsAuthenticated]
    def post(self,request,pk):
        denied=_gate(request)
        if denied:return denied
        updated=ClientRecognition.objects.filter(user=request.user,pk=pk,published=True,
            dismissed_at__isnull=True).update(dismissed_at=timezone.now())
        return Response({"dismissed":bool(updated)},status=200 if updated else 404)

class AdminRewardsStats(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        denied=_gate(request,admin=True)
        if denied:return denied
        records=PointEntry.objects.values("user_id").annotate(earned=Sum("points_delta"),
            events=Count("pk")).order_by("-earned","user_id")[:20]
        # Admin only. No public rankings, negative scores, spend or private emails.
        leaders=[{"client_id":r["user_id"],"points":max(r["earned"] or 0,0),
                  "events":r["events"]} for r in records if (r["earned"] or 0)>0]
        return Response({
            "affiliate_applications":AffiliateAccount.objects.filter(status="pending").count(),
            "affiliates_approved":AffiliateAccount.objects.filter(status="approved").count(),
            "attributed_signups":ReferralAttribution.objects.count(),
            "points_issued":PointEntry.objects.filter(points_delta__gt=0).aggregate(v=Sum("points_delta"))["v"] or 0,
            "pending_commissions_ngn":str(CommissionEntry.objects.filter(status="pending")
                .aggregate(v=Sum("amount_ngn"))["v"] or Decimal("0")),
            "top_advocates_private":leaders,
            "public_leaderboard_enabled":False,
        },headers={"Cache-Control":"private, no-store"})

class AdminAffiliateList(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        denied=_gate(request,admin=True)
        if denied:return denied
        accounts=AffiliateAccount.objects.order_by("-created_at","pk")[:100]
        return Response({"results":[
            {"id":a.pk,"client_id":a.user_id,"status":a.status,
             "created_at":a.created_at.isoformat()}
            for a in accounts
        ]},headers={"Cache-Control":"private, no-store"})

class AdminAffiliateReview(APIView):
    permission_classes=[IsAuthenticated]
    def post(self,request,pk):
        denied=_gate(request,admin=True)
        if denied:return denied
        decision=request.data.get("decision")
        if decision not in ("approve","reject","suspend"):
            return Response({"detail":"Invalid decision."},status=400)
        with transaction.atomic():
            account=AffiliateAccount.objects.select_for_update().filter(pk=pk).first()
            if not account:return Response({"detail":"Not found."},status=404)
            if account.status=="suspended" and decision=="approve":
                return Response({"detail":"Suspended accounts require compliance review."},status=409)
            account.status={"approve":"approved","reject":"rejected","suspend":"suspended"}[decision]
            account.reviewed_at=timezone.now()
            account.reviewed_by=request.user
            account.save(update_fields=["status","reviewed_at","reviewed_by"])
        return Response({"id":account.pk,"status":account.status})

def _verified_invoice(invoice):
    # Status flags alone are not settlement authority.
    if (invoice.status!="paid" or invoice.currency!="NGN" or
        invoice.total<=0 or invoice.amount_paid<invoice.total or
        invoice.amount_due>0):
        return False
    transactions=Transaction.objects.filter(
        invoice=invoice,client_id=invoice.client_id,transaction_type="payment",
        status="successful",webhook_verified=True,currency="NGN",
        gateway__status="active",gateway__test_mode=False,
    )
    settled=transactions.aggregate(v=Sum("amount"))["v"] or Decimal("0")
    # A refund/chargeback invalidates eligibility pending reconciliation.
    refunded=Transaction.objects.filter(
        invoice=invoice,status__in=("successful","refunded"),
        transaction_type="refund").exists()
    return settled>=invoice.total and not refunded

class AdminGrantPurchasePoints(APIView):
    """One grant per paid invoice, admin manual release only, no user-supplied points."""
    permission_classes=[IsAuthenticated]
    def post(self,request):
        denied=_gate(request,admin=True)
        if denied:return denied
        invoice_id=request.data.get("invoice_id")
        if type(invoice_id) is not int or invoice_id<1:
            return Response({"detail":"Valid invoice id required."},status=400)
        with transaction.atomic():
            invoice=Invoice.objects.select_for_update().filter(pk=invoice_id).first()
            policy=_policy()
            if not invoice:return Response({"detail":"Invoice unavailable."},status=404)
            if not policy or not policy.is_active or not policy.points_per_ngn:
                return Response({"detail":"Rewards are not active."},status=409)
            if not _verified_invoice(invoice):
                return Response({"detail":"Verified live settlement required."},status=409)
            if invoice.order_id and invoice.order.status in ("cancelled","failed","needs_review"):
                return Response({"detail":"Order is not eligible."},status=409)
            key=f"paid-invoice:{invoice.pk}"
            existing=PointEntry.objects.filter(event_key=key).first()
            if existing:return Response({"id":existing.pk,"points":existing.points_delta,"already_recorded":True})
            points=int((invoice.total / Decimal(policy.points_per_ngn)).to_integral_value(rounding=ROUND_DOWN))
            points=min(points,50000)
            if points<=0:return Response({"detail":"Invoice below earning threshold."},status=409)
            entry=PointEntry.objects.create(user=invoice.client,event_key=key,
                points_delta=points,kind="purchase",order=invoice.order,approved_by=request.user,
                note="Verified paid invoice loyalty award")
        return Response({"id":entry.pk,"points":entry.points_delta,"already_recorded":False},status=201)

class AdminReversePurchasePoints(APIView):
    """Append a compensating debit only after verified live refund evidence."""
    permission_classes=[IsAuthenticated]
    def post(self,request):
        denied=_gate(request,admin=True)
        if denied:return denied
        invoice_id=request.data.get("invoice_id")
        if type(invoice_id) is not int or invoice_id<1:
            return Response({"detail":"Valid invoice id required."},status=400)
        with transaction.atomic():
            invoice=Invoice.objects.select_for_update().filter(pk=invoice_id).first()
            if not invoice:return Response({"detail":"Invoice unavailable."},status=404)
            award=PointEntry.objects.filter(event_key=f"paid-invoice:{invoice.pk}",
                                             user=invoice.client,points_delta__gt=0).first()
            if not award:return Response({"detail":"No original reward to reverse."},status=404)
            # Do not allow a browser-provided refund flag to invent a clawback.
            actual_refund=Transaction.objects.filter(
                invoice=invoice,client_id=invoice.client_id,transaction_type="refund",
                status="successful",webhook_verified=True,currency="NGN",
                gateway__status="active",gateway__test_mode=False
            ).exists()
            if not actual_refund:
                return Response({"detail":"Verified live refund required."},status=409)
            key=f"refund-invoice:{invoice.pk}"
            previous=PointEntry.objects.filter(event_key=key).first()
            if previous:return Response({"id":previous.pk,"already_recorded":True})
            entry=PointEntry.objects.create(
                user=invoice.client,event_key=key,points_delta=-award.points_delta,
                kind="reversal",order=invoice.order,approved_by=request.user,
                note="Verified refunded invoice reward reversal")
        return Response({"id":entry.pk,"already_recorded":False},status=201)

class AdminRecognize(APIView):
    permission_classes=[IsAuthenticated]
    def post(self,request):
        denied=_gate(request,admin=True)
        if denied:return denied
        client_id=request.data.get("client_id")
        title=request.data.get("title")
        message=request.data.get("message")
        if type(client_id) is not int or not isinstance(title,str) or not isinstance(message,str) or (
            not 4<=len(title.strip())<=120 or not 8<=len(message.strip())<=500):
            return Response({"detail":"Client, title and appreciation message required."},status=400)
        user=User.objects.filter(pk=client_id,role="client",is_active=True).first()
        if not user:return Response({"detail":"Client unavailable."},status=404)
        # Customer-specific, private, positive message; never publish a ranking.
        recognition=ClientRecognition.objects.create(user=user,title=title.strip(),
            message=message.strip(),approved_by=request.user,published=True)
        return Response({"id":recognition.pk,"published":True},status=201)
