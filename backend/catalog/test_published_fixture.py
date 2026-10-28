"""Synthetic published offer fixture for tests. Never used in runtime code."""
from catalog.models import PublishedCatalogOffer,PlanProviderMapping
from providers.models import Provider,ProviderPackage

def attach_test_published_offer(plan,cycle):
    """Synthetic owned-server provider confirms package mapping and version for test orders."""
    provider=Provider.objects.create(
       name=f"CI supplier {plan.pk}",adapter_type="CpanelAdapter",
       base_url="https://synthetic-panel.example.test:2087",
       status="active",health_status="healthy",
       config={"fulfillment_model":"owned_server"},
    )
    pkg=ProviderPackage.objects.create(
       provider=provider,name="CI verified package",provider_package_id=f"ci-plan-{plan.pk}",
       is_active=True,raw_data={"origin":"adapter_verified","adapter":"CpanelAdapter"},
       specs={"quota":"10240","bwlimit":"100000"},pricing={},
    )
    PlanProviderMapping.objects.create(plan=plan,provider_id=provider.pk,
       adapter_type=provider.adapter_type,provider_package_id=pkg.provider_package_id,
       is_active=True,provider_package_name=pkg.name)
    PublishedCatalogOffer.objects.create(plan=plan,revision=1,snapshot={
       "product_id":plan.product_id,"plan_id":plan.pk,
       "currency":plan.currency,"supplier_provider_id":provider.pk,
       "supplier_inventory_id":pkg.pk,"technical_package_id":pkg.provider_package_id,
       "billing_cycles":[{"cycle_key":cycle.cycle_key,"price":str(cycle.price),
                         "setup_fee":str(cycle.setup_fee),"is_default":True}],
    })
    return provider,pkg
