"""Read-only, anonymous storefront presentation of Admin-published Cloud data.

No browser-supplied prices, no supplier cost/config, no registrar availability
guessing. The Console remains the exclusive checkout and payment authority.
"""
from django.db.models import Prefetch
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Plan, PlanBillingCycle, PlanFeature, ProductCategory
from domains.models import TLDPricing
from domains.registrar_quote import HOSTNAME
from knowledge_base.models import KnowledgeArticle


class PublicPublishedPlans(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Plan.objects.filter(
            status="active", is_public=True, published_versions__isnull=False,
            product__status="active", product__is_public=True,
            product__category__is_active=True,
        ).select_related("product").prefetch_related(
            Prefetch("billing_cycles", queryset=PlanBillingCycle.objects.filter(is_active=True)),
            Prefetch("features", queryset=PlanFeature.objects.all()),
        ).distinct().order_by("sort_order", "pk")[:100]
        plans = []
        for plan in qs:
            cycles = [
                {"key": c.cycle_key, "months": c.months, "label": c.label,
                 "total_price": str(c.price), "regular_price": str(c.regular_price) if c.regular_price else None,
                 "setup_fee": str(c.setup_fee), "is_default": c.is_default}
                for c in plan.billing_cycles.all() if c.months and c.price > 0
            ]
            if not cycles:
                continue
            plans.append({
                "id": plan.pk, "name": plan.name, "slug": plan.slug,
                "description": plan.description or "",
                "product_type": plan.product.product_type,
                "product_name": plan.product.name, "currency": plan.currency,
                "is_popular": plan.is_popular,
                "features": [f"{f.label}: {f.value}" if f.value else f.label
                             for f in plan.features.all()],
                "billing_cycles": cycles,
            })
        return Response({"plans": plans}, headers={"Cache-Control": "public, max-age=60"})


class PublicPublishedCategories(APIView):
    """Expose only visible, published and priced categories; never supplier details.

    Visibility is not permission to charge or provision. Checkout remains authoritative.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        categories = ProductCategory.objects.filter(
            is_active=True,
            products__status="active", products__is_public=True,
            products__plans__status="active", products__plans__is_public=True,
            products__plans__published_versions__isnull=False,
            products__plans__billing_cycles__is_active=True,
            products__plans__billing_cycles__price__gt=0,
        ).distinct().order_by("sort_order", "name", "pk")[:100]
        return Response({"categories": [
            {"slug": c.slug, "name": c.name, "description": c.description or ""}
            for c in categories
        ]}, headers={"Cache-Control": "public, max-age=60"})


class PublicDomainPrices(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        items = TLDPricing.objects.filter(status="active").order_by("sort_order", "tld")[:150]
        return Response({"currency": "NGN", "registrar_connected": False,
                         "tlds": [{"tld": item.tld.lower(), "registration_price": str(item.register_price),
                                   "renewal_price": str(item.renewal_price),
                                   "transfer_price": str(item.transfer_price)}
                                  for item in items if item.register_price > 0]},
                        headers={"Cache-Control": "public, max-age=60"})


class PublicDomainLookup(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        domain = request.query_params.get("domain", "").strip().lower()
        if not HOSTNAME.fullmatch(domain):
            raise ValidationError({"domain": "Enter a valid domain name."})
        # Longest suffix wins (.com.ng over .ng). No supplier is connected,
        # so this endpoint must never claim an available/registered result.
        supported = [p for p in TLDPricing.objects.filter(status="active")
                     if domain.endswith("." + p.tld.lstrip(".").lower())]
        price = max(supported, key=lambda p: len(p.tld), default=None)
        return Response({
            "domain": domain, "availability": "unverified",
            "registrar_connected": False, "checkout_enabled": False,
            "tld": price.tld if price else None,
            "currency": "NGN" if price else None,
            "registration_price": str(price.register_price) if price else None,
            "renewal_price": str(price.renewal_price) if price else None,
            "message": "A registrar availability check is required before you can register this domain.",
        }, headers={"Cache-Control": "no-store"})


class PublicKnowledgeArticles(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, slug=None):
        qs = KnowledgeArticle.objects.filter(status="published", visibility="client")
        if slug:
            from django.shortcuts import get_object_or_404
            article = get_object_or_404(qs, slug=slug)
            return Response({
                "slug": article.slug, "title": article.title,
                "summary": article.summary, "category": article.category,
                "body_markdown": article.body_markdown,
                "updated_at": article.updated_at.isoformat(),
            }, headers={"Cache-Control": "public, max-age=60"})
        rows = qs.order_by("category", "title")[:150]
        return Response({"articles": [
            {"slug": a.slug, "title": a.title, "summary": a.summary,
             "category": a.category, "updated_at": a.updated_at.isoformat()}
            for a in rows
        ]}, headers={"Cache-Control": "public, max-age=60"})
