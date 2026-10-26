from datetime import datetime, timedelta, timezone
from decimal import Decimal
from django.test import SimpleTestCase
from domains.registrar_quote import (
    preview_domain_quote, execute_domain_registration,
    execute_nameserver_change, RegistrarNotReady,
)


class RegistrarQuoteReviewTests(SimpleTestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 26, 8, 0, tzinfo=timezone.utc)
        self.supplier = {
            "source": "approved_registrar_api", "reference": "registrar-A00042",
            "domain": "octalve-example.com", "tld": ".com",
            "years": 1, "available": True, "currency": "NGN",
            "cost": "15000.00", "checked_at": self.now-timedelta(minutes=2),
            "expires_at": self.now+timedelta(minutes=5),
        }

    def quote(self, **overrides):
        return preview_domain_quote(
            domain="octalve-example.com", tld=".com",years=1,
            supplier={**self.supplier, **overrides},
            retail_price="20000.00",discount="2000.00", now=self.now)

    def test_supplier_cost_markup_discount_and_stable_reference(self):
        quote=self.quote()
        self.assertEqual(quote.supplier_cost, Decimal("15000.00"))
        self.assertEqual(quote.retail_price-quote.discount, Decimal("18000.00"))
        self.assertEqual(quote.supplier_reference, "registrar-A00042")
        self.assertFalse(quote.executable)
        with self.assertRaises(RegistrarNotReady):
            execute_domain_registration(quote)

    def test_reject_unavailable_expired_stale_and_tampered_supplier(self):
        for changes in (
            {"source":"browser"},
            {"available":False},
            {"domain":"someone-else.com"},
            {"currency":"ngn"},
            {"checked_at":self.now-timedelta(hours=1)},
            {"expires_at":self.now},
            {"expires_at":self.now+timedelta(hours=1)},
            {"reference":" "},
            {"cost":"NaN"},
            {"cost":"200000000000"},
        ):
            with self.subTest(changes=changes), self.assertRaises(RegistrarNotReady):
                self.quote(**changes)

    def test_price_floor_and_domain_normalization(self):
        with self.assertRaises(RegistrarNotReady):
            preview_domain_quote(
                domain="octalve-example.com",tld=".com",years=1,
                supplier=self.supplier,retail_price="16000",discount="2000",
                now=self.now)
        for domain in ("octalve-example.com.evil.test",
                       "Octalve-example.com","octalve-example.com/",
                       "localhost","-bad.com"):
            with self.subTest(domain=domain), self.assertRaises(RegistrarNotReady):
                preview_domain_quote(domain=domain,tld=".com",years=1,
                                     supplier=self.supplier,retail_price="20000",
                                     now=self.now)

    def test_registrar_write_and_nameservers_never_inferred(self):
        with self.assertRaises(RegistrarNotReady):
            execute_domain_registration()
        with self.assertRaises(RegistrarNotReady):
            execute_nameserver_change()
