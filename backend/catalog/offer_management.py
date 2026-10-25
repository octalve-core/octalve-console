"""A2 admin-only drafts and explicit publication of supplier-backed retail offers.

One public price authority: PlanBillingCycle.  ProviderPackage is internal
supplier inventory, and PublishedCatalogOffer is the immutable version ledger.
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from catalog.models import (
    CatalogOfferDraft, PublishedCatalogOffer, Plan, PlanFeature,
    PlanBillingCycle, PlanProviderMapping, Product,
)
from catalog.permissions import InternalSupplierAuthority
from providers.models import ProviderPackage


MONTHS = {'1mo': 1, '3mo': 3, '6mo': 6, '12mo': 12, '24mo': 24, '36mo': 36}
TECHNICAL = {
    'storage': ('quota', 'quota'), 'disk space': ('quota', 'quota'),
    'bandwidth': ('bandwidth', 'bwlimit'),
    'email accounts': ('nemails', 'maxpop'),
    'databases': ('mysql', 'maxsql'),
    'ftp accounts': ('ftp', 'maxftp'),
}


class FeatureInput(serializers.Serializer):
    label = serializers.CharField(max_length=100)
    value = serializers.CharField(max_length=100)
    is_highlighted = serializers.BooleanField(default=False)


class CycleInput(serializers.Serializer):
    cycle_key = serializers.ChoiceField(choices=list(MONTHS))
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    setup_fee = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'), default=Decimal('0'))
    regular_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'), required=False, allow_null=True)
    is_default = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs.get('regular_price') and attrs['regular_price'] < attrs['price']:
            raise serializers.ValidationError('Regular price cannot be below sale price.')
        return attrs


class OfferInput(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    provider_package_id = serializers.PrimaryKeyRelatedField(queryset=ProviderPackage.objects.select_related('provider').all())
    plan_id = serializers.PrimaryKeyRelatedField(queryset=Plan.objects.all(), required=False, allow_null=True)
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True)
    currency = serializers.RegexField(regex=r'^[A-Z]{3}$', max_length=3)
    is_popular = serializers.BooleanField(default=False)
    features = FeatureInput(many=True)
    billing_cycles = CycleInput(many=True, allow_empty=False)

    def validate(self, attrs):
        keys = [c['cycle_key'] for c in attrs['billing_cycles']]
        if len(set(keys)) != len(keys):
            raise serializers.ValidationError({'billing_cycles': 'Billing periods must be unique.'})
        if sum(bool(c['is_default']) for c in attrs['billing_cycles']) > 1:
            raise serializers.ValidationError({'billing_cycles': 'Only one default billing period is allowed.'})
        if attrs.get('plan_id') and attrs['plan_id'].product_id != attrs['product_id'].pk:
            raise serializers.ValidationError({'plan_id': 'Plan belongs to a different product.'})
        if attrs['product_id'].product_type not in ('shared_hosting', 'wordpress_hosting', 'vps'):
            raise serializers.ValidationError({'product_id': 'A1/A2 currently publishes hosting and VPS offers only.'})
        return attrs


def _freeze(validated):
    """Persist data as JSON primitives, never Decimal or model references."""
    return {
        'product_id': validated['product_id'].pk,
        'provider_package_id': validated['provider_package_id'].pk,
        'plan_id': validated.get('plan_id').pk if validated.get('plan_id') else None,
        'name': validated['name'], 'description': validated.get('description', ''),
        'currency': validated['currency'], 'is_popular': validated['is_popular'],
        'features': [dict(x) for x in validated['features']],
        'billing_cycles': [
            {'cycle_key': x['cycle_key'], 'price': str(x['price']),
             'setup_fee': str(x['setup_fee']),
             'regular_price': str(x.get('regular_price')) if x.get('regular_price') else None,
             'is_default': x['is_default']} for x in validated['billing_cycles']
        ],
    }


def _decimal_quantity(value, unit):
    text = str(value).strip().lower().replace(',', '')
    if text == 'unlimited':
        return None
    if unit == 'megabytes':
        if text.endswith('gb'):
            return Decimal(text[:-2].strip()) * 1024
        if text.endswith('mb'):
            return Decimal(text[:-2].strip())
    return Decimal(text)


def check_resource_claims(features, specs, adapter_type):
    """Reject overstated/unknown limits rather than selling fictitious capacity."""
    panel_index = 0 if adapter_type == 'DirectAdminAdapter' else 1
    for feature in features:
        key = feature['label'].strip().lower()
        if key not in TECHNICAL:
            continue  # Non-resource marketing claims need separate human review.
        supplier_key = TECHNICAL[key][panel_index]
        if supplier_key not in specs:
            raise serializers.ValidationError({'features': f'Provider does not verify {feature["label"]}.'})
        offered = str(feature['value']).strip().lower()
        actual = str(specs[supplier_key]).strip().lower()
        try:
            claimed = _decimal_quantity(offered, 'megabytes' if key in ('storage', 'disk space', 'bandwidth') else 'count')
            supplied = _decimal_quantity(actual, 'count')
        except (ValueError, ArithmeticError):
            raise serializers.ValidationError({'features': f'Unverifiable {feature["label"]} limit.'})
        if claimed is None and supplied is not None:
            raise serializers.ValidationError({'features': f'{feature["label"]} is not unlimited at supplier.'})
        if supplied is not None and claimed is not None and claimed > supplied:
            raise serializers.ValidationError({'features': f'{feature["label"]} exceeds supplier allowance.'})


def check_supplier_offer(package, offer):
    provider = package.provider
    if provider.status != 'active' or provider.health_status != 'healthy':
        raise serializers.ValidationError('Supplier must be active and connection-tested healthy.')
    if not package.is_active or package.raw_data.get('origin') != 'adapter_verified':
        raise serializers.ValidationError('Supplier package must be imported and individually approved.')
    model = provider.config.get('fulfillment_model')
    if model not in ('owned_server', 'partner_reseller'):
        raise serializers.ValidationError('Set provider fulfillment_model: owned_server or partner_reseller.')
    if provider.adapter_type not in ('DirectAdminAdapter', 'CpanelAdapter'):
        raise serializers.ValidationError('No qualified package inventory adapter for this provider.')
    if not package.specs:
        raise serializers.ValidationError('Supplier resource inventory is missing.')
    check_resource_claims(offer['features'], package.specs, provider.adapter_type)
    if model == 'partner_reseller':
        wholesale = package.pricing
        if wholesale.get('currency') != offer['currency'] or not isinstance(wholesale.get('cycles'), dict):
            raise serializers.ValidationError('Partner resale requires approved cost by billing period in the same currency.')
        for cycle in offer['billing_cycles']:
            cost = wholesale['cycles'].get(cycle['cycle_key'])
            try:
                amount = Decimal(str(cost))
            except (ValueError, ArithmeticError):
                raise serializers.ValidationError('Partner supplier cost missing for billing period.')
            if amount <= 0 or Decimal(cycle['price']) < amount:
                raise serializers.ValidationError('Retail price must cover approved supplier cost for each period.')


class OfferDraftViewSet(viewsets.ViewSet):
    permission_classes = [InternalSupplierAuthority]

    def list(self, request):
        rows = CatalogOfferDraft.objects.select_related('product', 'provider_package__provider', 'plan')[:200]
        return Response([{
            'id': x.id, 'product_name': x.product.name, 'provider': x.provider_package.provider.name,
            'supplier_package': x.provider_package.name, 'plan_id': x.plan_id,
            'status': x.status, 'payload': x.payload, 'updated_at': x.updated_at,
        } for x in rows])

    def create(self, request):
        serializer = OfferInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        row = CatalogOfferDraft.objects.create(
            product=v['product_id'], provider_package=v['provider_package_id'],
            plan=v.get('plan_id'), payload=_freeze(v), created_by=request.user,
        )
        return Response({'id': row.pk, 'status': 'draft'}, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        draft = get_object_or_404(CatalogOfferDraft, pk=pk)
        if draft.status != 'draft':
            return Response({'error': 'Published drafts are immutable. Create a new draft revision.'}, status=409)
        serializer = OfferInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        draft.product = v['product_id']
        draft.provider_package = v['provider_package_id']
        draft.plan = v.get('plan_id')
        draft.payload = _freeze(v)
        draft.save(update_fields=['product', 'provider_package', 'plan', 'payload', 'updated_at'])
        return Response({'id': draft.pk, 'status': draft.status})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def publish(self, request, pk=None):
        draft = get_object_or_404(
            CatalogOfferDraft.objects.select_for_update().select_related('product', 'provider_package__provider', 'plan'), pk=pk
        )
        if draft.status != 'draft':
            return Response({'error': 'Only a draft can be published.'}, status=409)
        serializer = OfferInput(data=draft.payload)
        serializer.is_valid(raise_exception=True)
        offer = draft.payload
        product, package = draft.product, draft.provider_package
        if product.status != 'active' or not product.is_public or not product.category.is_active:
            raise serializers.ValidationError('Product category and product must be public and active.')
        check_supplier_offer(package, offer)

        plan = draft.plan
        if plan:
            plan = Plan.objects.select_for_update().get(pk=plan.pk)
            if plan.product_id != product.pk:
                raise serializers.ValidationError('Draft plan and product do not match.')
        else:
            slug = slugify(offer['name'])
            if Plan.objects.filter(product=product, slug=slug).exists():
                raise serializers.ValidationError('This product already has a plan with that name.')
            plan = Plan(product=product, slug=slug)
        plan.name = offer['name']
        plan.description = offer.get('description', '')
        plan.currency = offer['currency']
        plan.is_popular = offer['is_popular']
        plan.is_public = True
        plan.status = 'active'
        plan.base_price = Decimal(offer['billing_cycles'][0]['price'])
        plan.save()

        PlanFeature.objects.filter(plan=plan).delete()
        for index, feature in enumerate(offer['features']):
            PlanFeature.objects.create(plan=plan, label=feature['label'], value=feature['value'],
                is_highlighted=feature['is_highlighted'], sort_order=index)
        included = set()
        for index, cycle in enumerate(offer['billing_cycles']):
            included.add(cycle['cycle_key'])
            PlanBillingCycle.objects.update_or_create(plan=plan, cycle_key=cycle['cycle_key'], defaults={
                'months': MONTHS[cycle['cycle_key']], 'price': Decimal(cycle['price']),
                'regular_price': Decimal(cycle['regular_price']) if cycle['regular_price'] else None,
                'discount_percent': Decimal('0'), 'setup_fee': Decimal(cycle['setup_fee']),
                'is_active': True, 'is_default': cycle['is_default'] or (
                    index == 0 and not any(c['is_default'] for c in offer['billing_cycles']))
            })
        PlanBillingCycle.objects.filter(plan=plan).exclude(cycle_key__in=included).update(is_active=False, is_default=False)
        PlanProviderMapping.objects.filter(plan=plan).exclude(
            provider_id=package.provider_id, adapter_type=package.provider.adapter_type
        ).update(is_active=False)
        PlanProviderMapping.objects.update_or_create(
            plan=plan, provider_id=package.provider_id, adapter_type=package.provider.adapter_type,
            defaults={'provider_package_id': package.provider_package_id,
                      'provider_package_name': package.name, 'server_group': package.provider.server_group,
                      'is_active': True},
        )
        latest = PublishedCatalogOffer.objects.filter(plan=plan).aggregate(Max('revision'))['revision__max'] or 0
        revision = latest + 1
        PublishedCatalogOffer.objects.create(plan=plan, revision=revision, snapshot={
            **offer, 'supplier_provider_id': package.provider_id,
            'supplier_inventory_id': package.pk, 'technical_package_id': package.provider_package_id,
        }, published_by=request.user)
        draft.plan, draft.status = plan, 'published'
        draft.save(update_fields=['plan', 'status', 'updated_at'])
        return Response({'plan_id': plan.pk, 'published_revision': revision, 'status': 'published'})
