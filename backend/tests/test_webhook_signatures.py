"""Stdlib-only tests: no production credentials or external database needed."""
import hashlib
import hmac
import unittest
from payments.signatures import verify_webhook_signature


class WebhookSignatureTests(unittest.TestCase):
    def setUp(self):
        self.raw = b'{"event":"charge.success","data":{"reference":"test"}}'

    def test_paystack_signature_and_tampering(self):
        secret = "sk_test_test"
        signature = hmac.new(secret.encode(), self.raw, hashlib.sha512).hexdigest()
        headers = {"X-Paystack-Signature": signature}
        self.assertTrue(verify_webhook_signature("paystack", secret, headers, self.raw))
        self.assertFalse(verify_webhook_signature("paystack", secret, headers, self.raw + b"x"))

    def test_flutterwave_v3_does_not_accept_paystack_header(self):
        self.assertTrue(verify_webhook_signature("flutterwave", "hash_test", {"verif-hash": "hash_test"}, self.raw))
        self.assertFalse(verify_webhook_signature("flutterwave", "hash_test", {"verif-hash": "wrong"}, self.raw))
        self.assertFalse(verify_webhook_signature("flutterwave", "hash_test", {"X-Paystack-Signature": "hash_test"}, self.raw))

    def test_missing_secret_signature_unknown_gateway_and_invalid_body(self):
        for gateway in ("paystack", "flutterwave"):
            self.assertFalse(verify_webhook_signature(gateway, "", {}, self.raw))
            self.assertFalse(verify_webhook_signature(gateway, None, {}, self.raw))
            self.assertFalse(verify_webhook_signature(gateway, "secret", {}, self.raw))
        self.assertFalse(verify_webhook_signature("other", "secret", {"verif-hash": "secret"}, self.raw))
        self.assertFalse(verify_webhook_signature("flutterwave", "secret", {"verif-hash": "secret"}, "string"))


if __name__ == "__main__":
    unittest.main()
