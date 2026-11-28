"""A configuration-only adapter must never be mistaken for remote proof.

The production Integration Store uses independently qualified readback and
execution paths. The legacy adapter registry is not such an authority.
"""
import unittest

from apps.providers.registry import ADAPTER_REGISTRY, get_adapter


class LegacyProviderAdapterTests(unittest.TestCase):
    def test_unimplemented_adapters_do_not_claim_connection_or_mutation(self):
        self.assertGreater(len(ADAPTER_REGISTRY), 0)
        for name in ADAPTER_REGISTRY:
            with self.subTest(adapter=name):
                adapter = get_adapter(name, {})
                for method, args in (
                    ("test_connection", ()),
                    ("provision", (None,)),
                    ("suspend", (None,)),
                    ("unsuspend", (None,)),
                    ("terminate", (None,)),
                    ("fetch_usage", (None,)),
                ):
                    with self.subTest(method=method):
                        result = getattr(adapter, method)(*args)
                        self.assertIs(result.ok, False)
                        self.assertIs(result.retryable, False)
                        self.assertIsNone(result.provider_reference)
                        self.assertIsNone(result.data)
