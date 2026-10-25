"""No-money, no-network verification tests for provider APIs."""
import io
import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from django.test import SimpleTestCase, override_settings
from payments.readback import PaymentReadbackRejected, verify_gateway_intent


def response(body, status=200, headers=None):
    raw = json.dumps(body).encode()
    wire = Mock()\n    wire.read.return_value = raw\n    return SimpleNamespace(status_code=status, raw=wire,\n                           headers=headers or {}, close=lambda: None)


@override_settings(CLOUD_GATEWAY_READBACK_ENABLED=True)
class GatewayReadbackTests(SimpleTestCase):
    def setup_intent(self, code="paystack"):
        gateway = SimpleNamespace(code=code, status="active", test_mode=False,
                                  get_secret_key=lambda: "sk_live_test-fixture-never-deploy-0123456789")
        order = SimpleNamespace(client_id=7, status="pending_payment", currency="NGN")
        invoice = SimpleNamespace(order=order, client_id=7, currency="NGN",
                                  status="unpaid", total=Decimal("200.00"),
                                  amount_paid=Decimal("0.00"))
        intent = SimpleNamespace(gateway=gateway, invoice=invoice,
                                 client_id=7, currency="NGN", status="pending",
                                 amount=Decimal("200.00"), reference="OLPAY_123456",
                                 is_expired=lambda: False)
        return intent

    def paystack(self, **data):
        item = {"id": 1234567, "domain": "live", "status": "success",
                "reference": "OLPAY_123456", "currency": "NGN", "amount": 20000}
        item.update(data)
        return response({"status": True, "data": item})

    def flutterwave(self, **data):
        item = {"id": 1234567, "status": "successful",
                "tx_ref": "OLPAY_123456", "currency": "NGN", "amount": 200}
        item.update(data)
        return response({"status": "success", "data": item})

    def test_paystack_minor_units_and_exact_id(self):
        getter = Mock(return_value=self.paystack())
        value = verify_gateway_intent(self.setup_intent(), getter=getter)
        self.assertEqual(value.amount, Decimal("200.00"))
        self.assertEqual(value.reference, "OLPAY_123456")
        self.assertEqual(value.remote_id, "1234567")
        self.assertEqual(getter.call_args.args[0],
                         "https://api.paystack.co/transaction/verify/OLPAY_123456")
        self.assertFalse(getter.call_args.kwargs["allow_redirects"])
        self.assertTrue(getter.call_args.kwargs["verify"])
        self.assertTrue(getter.call_args.kwargs["stream"])

    def test_flutterwave_verification_by_reference(self):
        get = Mock(return_value=self.flutterwave())
        value = verify_gateway_intent(self.setup_intent("flutterwave"), getter=get)
        self.assertEqual(value.gateway, "flutterwave")
        self.assertEqual(get.call_args.args[0],
                         "https://api.flutterwave.com/v3/transactions/verify_by_reference")
        self.assertEqual(get.call_args.kwargs["params"], {"tx_ref": "OLPAY_123456"})

    def test_bad_gateway_results_are_not_payment(self):
        cases = [
            self.paystack(status="failed"),
            self.paystack(reference="another_ref"),
            self.paystack(currency="USD"),
            self.paystack(amount=19999),
            self.paystack(amount=20001),
            self.paystack(domain="test"),
            self.paystack(id="other-account"),
            response({"status": False, "data": {"status": "success"}}),
            response({"status": True}, headers={"Content-Length": "1000000"}),
            self.paystack(),
        ]
        for ix, res in enumerate(cases):
            with self.subTest(case=ix):
                if ix == len(cases)-1:
                    res.status_code = 302
                with self.assertRaises(PaymentReadbackRejected):
                    verify_gateway_intent(self.setup_intent(), getter=Mock(return_value=res))

    def test_flutterwave_forged_success_and_amount_fail(self):
        for reply in (self.flutterwave(tx_ref="foreign-ref"),
                      self.flutterwave(status="failed"),
                      self.flutterwave(currency="USD"),
                      self.flutterwave(amount=199),
                      self.flutterwave(amount=201),
                      response({"status": "success", "data": {}})):
            with self.assertRaises(PaymentReadbackRejected):
                verify_gateway_intent(self.setup_intent("flutterwave"),
                                      getter=Mock(return_value=reply))

    def test_preflight_rejects_non_authorised_intents_without_get(self):
        changes = [
            ("client_id", 45), ("amount", Decimal("199")), ("currency", "USD"),
            ("status", "completed"), ("reference", "bad/ref"),
        ]
        for field, value in changes:
            obj = self.setup_intent()
            setattr(obj, field, value)
            get = Mock()
            with self.subTest(field=field), self.assertRaises(PaymentReadbackRejected):
                verify_gateway_intent(obj, getter=get)
            get.assert_not_called()

    def test_test_mode_and_gateway_disabled(self):
        intent = self.setup_intent()
        intent.gateway.test_mode = True
        with self.assertRaises(PaymentReadbackRejected):
            verify_gateway_intent(intent, getter=Mock())
        with override_settings(CLOUD_GATEWAY_READBACK_ENABLED=False):
            with self.assertRaises(PaymentReadbackRejected):
                verify_gateway_intent(self.setup_intent(), getter=Mock())
