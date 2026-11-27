from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from domains.models import Domain, TLDPricing
from orders.models import Cart
from orders.shopping_cart import COOKIE, CONSOLE, STOREFRONT


@override_settings(CLOUD_UNIFIED_SHOPPING_ENABLED=True)
class ShoppingCartTests(TestCase):
    guest = "/api/orders/shopping/guest/"
    grant = "/api/orders/shopping/grant/"
    claim = "/api/orders/shopping/claim/"
    account = "/api/orders/shopping/account/"

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.public = APIClient()
        self.console = APIClient()
        self.owner = get_user_model().objects.create_user(
            email="cart-owner@example.test", username="cartowner", role="client",
        )
        TLDPricing.objects.create(tld=".com", register_price=12000, renewal_price=14000, transfer_price=11000)
        self.item = {"kind": "domain", "domain": "example.com"}

    def add(self, **options):
        with patch("orders.shopping_cart.public_availability", return_value="available"):
            return self.public.post(self.guest, self.item, format="json", HTTP_ORIGIN=STOREFRONT, **options)

    def test_guest_cookie_server_price_and_idempotent_selection(self):
        first = self.add()
        self.assertEqual(first.status_code, 200)
        cookie = first.cookies[COOKIE]
        self.assertTrue(cookie["secure"])
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Strict")
        self.assertEqual(cookie["domain"], "")
        self.assertNotIn(cookie.value, Cart.objects.get().session_key)
        self.assertEqual(first.data["subtotal"], "12000.00")
        self.assertEqual(len(self.add().data["lines"]), 1)
        self.assertEqual(len(self.public.get(self.guest, HTTP_ORIGIN=STOREFRONT).data["lines"]), 1)
        self.assertEqual(APIClient().get(self.guest, HTTP_ORIGIN=STOREFRONT).data["lines"], [])

    def test_privacy_csrf_invalid_prices_and_unauthorized_account(self):
        denied = self.public.post(self.guest, self.item, format="json", HTTP_ORIGIN=STOREFRONT + ".example")
        self.assertEqual(denied.status_code, 403)
        invalid = self.public.post(self.guest, {**self.item, "price": 1}, format="json", HTTP_ORIGIN=STOREFRONT)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.console.get(self.account).status_code, 401)
        self.assertEqual(self.console.post(self.grant, {}, format="json").status_code, 401)
        self.assertFalse(Cart.objects.exists())

    def test_claim_is_console_only_preserves_account_and_invalidates_guest(self):
        self.console.force_authenticate(user=self.owner)
        with patch("orders.shopping_cart.public_availability", return_value="available"):
            existing = self.console.post(self.account, {"selections": [{"kind": "domain", "domain": "prior.com"}]}, format="json")
        self.assertEqual(existing.status_code, 200)
        self.assertEqual(self.add().status_code, 200)
        token = self.public.cookies[COOKIE].value
        grant = self.console.post(self.grant, {}, format="json").data["grant"]
        self.assertEqual(self.public.post(self.claim, {"grant": grant}, format="json", HTTP_ORIGIN=STOREFRONT).status_code, 403)
        self.assertEqual(self.public.post(self.claim, {"grant": "bad"}, format="json", HTTP_ORIGIN=CONSOLE).status_code, 403)
        claimed = self.public.post(self.claim, {"grant": grant}, format="json", HTTP_ORIGIN=CONSOLE)
        self.assertEqual(claimed.status_code, 200)
        self.assertEqual(len(claimed.data["lines"]), 2)
        self.public.cookies[COOKIE] = token
        self.assertEqual(self.public.get(self.guest, HTTP_ORIGIN=STOREFRONT).data["lines"], [])
        self.assertEqual(len(self.console.get(self.account).data["lines"]), 2)

    @override_settings(CLOUD_UNIFIED_SHOPPING_ENABLED=False)
    def test_disabled_routes_preserve_live_purchase_path(self):
        self.assertEqual(self.public.get(self.guest, HTTP_ORIGIN=STOREFRONT).status_code, 404)
        self.assertFalse(Cart.objects.exists())

    def test_expired_guest_and_failed_bundle_do_not_create_selections(self):
        from datetime import timedelta
        from django.utils import timezone

        self.assertEqual(self.add().status_code, 200)
        Cart.objects.update(created_at=timezone.now() - timedelta(hours=25))
        self.assertEqual(self.public.get(self.guest, HTTP_ORIGIN=STOREFRONT).data["lines"], [])
        with patch("orders.shopping_cart.public_availability", side_effect=["available", "unavailable"]):
            result = self.public.post(
                self.guest, {"bundle": ["one.com", "two.com"]}, format="json", HTTP_ORIGIN=STOREFRONT
            )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(Cart.objects.count(), 1)

    def test_legacy_guest_cannot_read_cart_owned_by_account(self):
        session = self.public.session
        Cart.objects.create(client=self.owner, session_key=session.session_key, items=[])
        answer = self.public.get("/api/orders/cart/get_cart/")
        self.assertEqual(answer.status_code, 200)
        self.assertEqual(Cart.objects.filter(client=self.owner).count(), 1)
        self.assertEqual(Cart.objects.filter(client__isnull=True).count(), 1)

    def test_guest_configuration_is_atomic_and_retryable(self):
        service = {"kind": "service", "plan": "1", "cycle": "1mo", "revision": 1}
        service_price = {"kind": "hosting", "name": "Hosting", "currency": "NGN", "amount": "1000", "period": "Monthly"}
        from orders.shopping_cart import priced_line

        def quote(item, **options):
            return service_price if item["kind"] == "service" else priced_line(item, **options)

        with patch("orders.shopping_cart.priced_line", side_effect=quote), patch(
            "orders.shopping_cart.public_availability", side_effect=["unavailable", "available", "available"]
        ):
            self.assertEqual(self.public.post(self.guest, service, format="json", HTTP_ORIGIN=STOREFRONT).status_code, 200)
            change = {"id": "service:1:1mo", "domain": "example.com", "register": True}
            denied = self.public.patch(self.guest, change, format="json", HTTP_ORIGIN=CONSOLE)
            self.assertEqual(denied.status_code, 403)
            failed = self.public.patch(self.guest, change, format="json", HTTP_ORIGIN=STOREFRONT)
            self.assertEqual(failed.status_code, 400)
            self.assertEqual(Cart.objects.get().items, [service])
            for _ in range(2):
                applied = self.public.patch(self.guest, change, format="json", HTTP_ORIGIN=STOREFRONT)
                self.assertEqual(applied.status_code, 200)
                self.assertEqual({line["id"] for line in applied.data["lines"]},
                                 {"service:1:1mo:example.com", "domain:example.com"})

    def test_guest_cannot_connect_a_domain_outside_the_cart(self):
        self.assertEqual(self.add().status_code, 200)
        cart = Cart.objects.get()
        cart.items.append({"kind": "service", "plan": "1", "cycle": "1mo", "revision": 1})
        cart.save()
        denied = self.public.patch(
            self.guest, {"id": "service:1:1mo", "domain": "other.com", "register": False},
            format="json", HTTP_ORIGIN=STOREFRONT,
        )
        self.assertEqual(denied.status_code, 400)
        self.assertEqual(Cart.objects.get().items, cart.items)

    def test_account_configuration_only_lists_and_connects_owned_domains(self):
        from orders.shopping_cart import account_cart

        self.console.force_authenticate(user=self.owner)
        other = get_user_model().objects.create_user(
            email="other-owner@example.test", username="otherowner", role="client",
        )
        Domain.objects.create(client=self.owner, domain_name="mine.com", tld=".com", status="active")
        Domain.objects.create(client=other, domain_name="theirs.com", tld=".com", status="active")
        cart = account_cart(self.owner.pk)
        cart.items = [{"kind": "service", "plan": "1", "cycle": "1mo", "revision": 1}]
        cart.save()
        with patch("orders.shopping_cart.priced_line", return_value={
            "kind": "hosting", "name": "Hosting", "currency": "NGN", "amount": "1000", "period": "Monthly",
        }):
            change = {"id": "service:1:1mo", "domain": "theirs.com", "register": False}
            self.assertEqual(self.console.patch(self.account, change, format="json").status_code, 400)
            change["domain"] = "mine.com"
            applied = self.console.patch(self.account, change, format="json")
            self.assertEqual(applied.status_code, 200)
            self.assertEqual(applied.data["domains"], ["mine.com"])
            self.assertEqual([line["id"] for line in applied.data["lines"]], ["service:1:1mo:mine.com"])

    def test_storefront_bridge_requires_current_refresh_and_matching_client(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        bridge = "/api/orders/shopping/storefront-account/"
        refresh = RefreshToken.for_user(self.owner)
        self.console.credentials(HTTP_AUTHORIZATION="Bearer " + str(refresh.access_token))
        self.assertEqual(self.console.get(bridge).status_code, 403)
        proof = {"HTTP_X_OCTALVE_SHOPPING_SESSION": str(refresh)}
        self.assertEqual(self.console.get(bridge, **proof).status_code, 200)
        with patch("orders.shopping_cart.public_availability", return_value="available"):
            added = self.console.post(bridge, {"selections": [self.item]}, format="json", **proof)
        self.assertEqual(added.status_code, 200)
        self.assertEqual(added.data["lines"][0]["selection"], self.item)
        other = get_user_model().objects.create_user(email="bridge-other@example.test", username="bridgeother", role="client")
        other_refresh = RefreshToken.for_user(other)
        self.assertEqual(self.console.get(bridge, HTTP_X_OCTALVE_SHOPPING_SESSION=str(other_refresh)).status_code, 403)
        refresh.blacklist()
        self.assertEqual(self.console.get(bridge, **proof).status_code, 403)
        self.assertEqual(self.console.delete(bridge, {"id":"domain:example.com"}, format="json", **proof).status_code, 403)
        self.assertEqual(Cart.objects.get(client=self.owner).items, [self.item])

    @override_settings(CLOUD_UNIFIED_SHOPPING_ENABLED=False)
    def test_storefront_bridge_gate_stays_closed(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.owner)
        self.console.credentials(HTTP_AUTHORIZATION="Bearer " + str(refresh.access_token))
        self.assertEqual(self.console.get("/api/orders/shopping/storefront-account/", HTTP_X_OCTALVE_SHOPPING_SESSION=str(refresh)).status_code, 404)

    def test_real_registration_login_claim_and_logout_cart_lifecycle(self):
        bridge = "/api/orders/shopping/storefront-account/"
        password = "SyntheticCartFixture-2026!"
        self.assertEqual(self.add().status_code, 200)
        registered = self.console.post("/api/auth/register/", {
            "email": "unified-registration@example.invalid", "username": "unified_registration",
            "full_name": "Synthetic Shopping", "password": password, "re_password": password,
        }, format="json")
        self.assertEqual(registered.status_code, 201, registered.data)
        self.console.credentials(HTTP_AUTHORIZATION="Bearer " + registered.data["access"])
        grant = self.console.post(self.grant, {}, format="json").data["grant"]
        claimed = self.public.post(self.claim, {"grant": grant}, format="json", HTTP_ORIGIN=CONSOLE)
        self.assertEqual(claimed.status_code, 200, claimed.data)
        proof = {"HTTP_X_OCTALVE_SHOPPING_SESSION": registered.data["refresh"]}
        self.assertEqual(self.console.get(bridge, **proof).data["lines"][0]["selection"], self.item)
        self.assertEqual(self.console.post("/api/auth/logout/", {"refresh": registered.data["refresh"]}, format="json").status_code, 200)
        self.assertEqual(self.console.get(bridge, **proof).status_code, 401)
        self.console.credentials()
        login = self.console.post("/api/auth/jwt/create/", {"email":"unified-registration@example.invalid","password":password}, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        self.console.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access"])
        new_proof = {"HTTP_X_OCTALVE_SHOPPING_SESSION":login.data["refresh"]}
        self.assertEqual(self.console.get(bridge, **new_proof).data["lines"][0]["selection"], self.item)
        self.assertEqual(self.console.get(bridge, **proof).status_code, 403)

    def test_failed_merge_preserves_guest_selection(self):
        self.assertEqual(self.add().status_code, 200)
        self.console.force_authenticate(user=self.owner)
        grant = self.console.post(self.grant, {}, format="json").data["grant"]
        TLDPricing.objects.filter(tld=".com").update(status="inactive")
        failed = self.public.post(self.claim, {"grant":grant}, format="json", HTTP_ORIGIN=CONSOLE)
        self.assertEqual(failed.status_code, 400, failed.data)
        self.assertEqual(Cart.objects.get(client__isnull=True).items, [self.item])
        self.assertFalse(Cart.objects.filter(client=self.owner).exists())

    def test_domain_specific_failures_and_checkout_limit(self):
        with patch("orders.shopping_cart.public_availability", return_value="unavailable"):
            result = self.public.post(self.guest, self.item, format="json", HTTP_ORIGIN=STOREFRONT)
        self.assertEqual(result.status_code, 400)
        self.assertEqual(result.data["code"], "domain_unavailable")
        self.assertEqual(result.data["domain"], "example.com")
        self.assertFalse(Cart.objects.exists())
        with patch("orders.shopping_cart.public_availability", return_value="unverified"):
            result = self.public.post(self.guest, self.item, format="json", HTTP_ORIGIN=STOREFRONT)
        self.assertEqual(result.data["code"], "domain_lookup_unconfirmed")
        self.console.force_authenticate(user=self.owner)
        selections = [{"kind": "domain", "domain": f"test-{i}.com"} for i in range(6)]
        with patch("orders.shopping_cart.public_availability", return_value="available"):
            result = self.console.post(self.account, {"selections": selections}, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertIn("up to 5 domains", result.data["checkout_issue"])
        cleaned = self.console.delete(self.account, {"ids": ["domain:test-0.com", "domain:test-1.com"]}, format="json")
        self.assertEqual(cleaned.status_code, 200)
        self.assertIsNone(cleaned.data["checkout_issue"])
        self.assertEqual(len(cleaned.data["lines"]), 4)
        self.assertEqual(cleaned.data["subtotal"], "48000.00")


    def test_empty_snapshot_reports_zero_ngn_without_inventing_nonempty_price(self):
        from orders.shopping_cart import snapshot
        empty = snapshot(None)
        self.assertEqual(empty["lines"], [])
        self.assertEqual(empty["subtotal"], "0.00")
        self.assertEqual(empty["currency"], "NGN")
        from types import SimpleNamespace
        from rest_framework.exceptions import ValidationError
        with patch("orders.shopping_cart.priced_line", side_effect=ValidationError("unpriced")):
            unpriced = snapshot(SimpleNamespace(items=[{"kind":"domain","domain":"example.com"}], client_id=None))
        self.assertIsNone(unpriced["subtotal"])
        self.assertIsNone(unpriced["currency"])
        self.assertFalse(unpriced["lines"][0]["ready"])
