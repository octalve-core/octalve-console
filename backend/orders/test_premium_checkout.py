"""BATCH-02: truthful quote, private invoice, checkout identity and payment gates."""
from decimal import Decimal
from uuid import uuid4
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from orders.models import Order, Coupon
from billing.models import Invoice
from catalog.models import ProductCategory, Product, Plan, PlanBillingCycle


class PremiumCheckoutTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user=User.objects.create_user(
            email="customer-b2@example.invalid",username="customerb2",
            password="UnusedTestPasswordB2!",full_name="Customer Example",
            company_name="Example Company",address="42 Test Avenue",
            city="Abuja",country="Nigeria",phone_number="+2348012345678",
        )
        self.other=User.objects.create_user(
            email="other-b2@example.invalid",username="otherb2",
            password="UnusedTestPasswordB2!")
        self.client=APIClient()
        self.client.force_authenticate(self.user)
        category=ProductCategory.objects.create(name="Hosting")
        product=Product.objects.create(category=category,name="Shared Hosting",
                                       product_type="shared_hosting",status="active",is_public=True)
        self.plan=Plan.objects.create(
            product=product,name="Stellar-style Starter",status="active",
            is_public=True,currency="NGN")
        PlanBillingCycle.objects.create(
            plan=self.plan,cycle_key="1mo",months=1,is_active=True,
            price=Decimal("2500.00"),setup_fee=Decimal("500.00"))

    def payload(self,key=None,domain="example.com"):
        return {"checkout_id":str(key or uuid4()),
                "items":[{"plan_id":self.plan.id,"cycle_key":"1mo",
                          "quantity":1,"domain_name":domain}]}

    def test_quote_is_read_only_and_ignores_browser_total(self):
        payload=self.payload()
        payload["total"]="0.01"  # Strict quote contract must reject unknown money fields.
        bad=self.client.post("/api/orders/orders/quote/",payload,format="json")
        self.assertEqual(bad.status_code,400,bad.data)
        payload.pop("total")
        response=self.client.post("/api/orders/orders/quote/",payload,format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(Decimal(response.data["total"]),Decimal("3000.00"))
        self.assertEqual(response.data["currency"],"NGN")
        self.assertEqual(Order.objects.count(),0)
        self.assertEqual(Invoice.objects.count(),0)

    def test_domain_path_not_accepted_as_hostname(self):
        response=self.client.post("/api/orders/orders/quote/",
             self.payload(domain="https://example.com/"),format="json")
        self.assertEqual(response.status_code,400,response.data)
        self.assertFalse(Order.objects.exists())

    def test_billing_snapshot_is_server_owned_and_unchanging(self):
        payload=self.payload()
        payload["billing_contact"]={"full_name":"Forged Customer","tax_exempt":True}
        result=self.client.post("/api/orders/orders/",payload,format="json")
        self.assertEqual(result.status_code,201,result.data)
        order=Order.objects.get()
        self.assertEqual(order.metadata["billing_contact"]["full_name"],"Customer Example")
        self.assertEqual(order.metadata["billing_contact"]["address"],"42 Test Avenue")
        inv=Invoice.objects.get(order=order)
        self.assertEqual(inv.metadata["billing_contact"]["full_name"],"Customer Example")
        self.user.full_name="Changed Later"
        self.user.save(update_fields=["full_name"])
        inv.refresh_from_db()
        self.assertEqual(inv.metadata["billing_contact"]["full_name"],"Customer Example")

    def test_invoice_pdf_owner_only_and_never_claims_paid(self):
        order=self.client.post("/api/orders/orders/",self.payload(),format="json")
        self.assertEqual(order.status_code,201,order.data)
        invoice=Invoice.objects.get()
        uri=f"/api/billing/invoices/{invoice.pk}/download_pdf/"
        response=self.client.get(uri)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response["Content-Type"],"application/pdf")
        self.assertEqual(response.content[:4],b"%PDF")
        self.assertIn("attachment",response["Content-Disposition"])
        self.client.force_authenticate(self.other)
        forbidden=self.client.get(uri)
        self.assertEqual(forbidden.status_code,404)

    def test_gateway_not_advertised_when_not_enabled(self):
        response=self.client.get("/api/payments/checkout-options/")
        self.assertEqual(response.status_code,200,response.data)
        self.assertIs(response.data["enabled"],False)
        self.assertEqual(response.data["gateways"],[])

    def test_quote_coupon_product_restriction_and_real_discount(self):
        code=Coupon.objects.create(
            code="B2SAVE",name="Valid promo",discount_type="fixed",
            discount_value=Decimal("200.00"),max_uses=10,
            starts_at=timezone.now()-timedelta(days=1),
            ends_at=timezone.now()+timedelta(days=7),is_active=True,
            applicable_plans=[self.plan.pk],
        )
        data=self.payload();data["coupon_code"]=code.code
        response=self.client.post("/api/orders/orders/quote/",data,format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(Decimal(response.data["total"]),Decimal("2800.00"))
        self.assertEqual(Coupon.objects.get(pk=code.pk).used_count,0)
        changed=self.client.post("/api/orders/orders/",data,format="json")
        self.assertEqual(changed.status_code,201,changed.data)
        self.assertEqual(Invoice.objects.get().total,Decimal("2800.00"))

    def test_coupon_not_valid_for_other_plan(self):
        Coupon.objects.create(
            code="NOTYOURS",name="Restricted",discount_type="fixed",
            discount_value=Decimal("200.00"),max_uses=10,
            starts_at=timezone.now()-timedelta(days=1),
            ends_at=timezone.now()+timedelta(days=7),is_active=True,
            applicable_plans=[self.plan.pk+5000],
        )
        data=self.payload();data["coupon_code"]="NOTYOURS"
        self.assertEqual(self.client.post("/api/orders/orders/quote/",data,format="json").status_code,400)
        self.assertEqual(self.client.post("/api/orders/orders/",data,format="json").status_code,400)
        self.assertFalse(Invoice.objects.exists())
