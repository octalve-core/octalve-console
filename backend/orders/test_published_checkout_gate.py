"""E4 regression: never create financial records from an unversioned hosting plan."""
from decimal import Decimal
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from catalog.models import ProductCategory, Product, Plan, PlanBillingCycle
from orders.models import Order
from billing.models import Invoice

class PublishedCheckoutGateTests(TestCase):
    def setUp(self):
        user=get_user_model().objects.create_user(
            email="unpublished-customer@example.test",username="unpublished-test",
            role="client",password="synthetic-test-password")
        self.api=APIClient()
        self.api.force_authenticate(user=user)
        category=ProductCategory.objects.create(name="Hosting")
        product=Product.objects.create(category=category,name="Unpublished hosting",
                                       product_type="shared_hosting",status="active",is_public=True)
        plan=Plan.objects.create(product=product,name="Legacy starter",status="active",
                                 is_public=True,currency="NGN")
        PlanBillingCycle.objects.create(plan=plan,cycle_key="1mo",months=1,
                                         price=Decimal("5000.00"),is_active=True)
        self.plan=plan

    def test_quote_and_checkout_reject_active_but_unpublished_offer(self):
        payload={"checkout_id":str(uuid4()),"items":[{"plan_id":self.plan.pk,
                    "cycle_key":"1mo","quantity":1}]}
        for route in ("/api/orders/orders/quote/","/api/orders/orders/"):
            with self.subTest(route=route):
                response=self.api.post(route,payload,format="json")
                self.assertEqual(response.status_code,400,response.data)
                self.assertIn("not approved for checkout",str(response.data))
        self.assertEqual(Order.objects.count(),0)
        self.assertEqual(Invoice.objects.count(),0)
