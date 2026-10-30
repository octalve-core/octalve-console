from .base import BaseAdapter
from ..contracts import AdapterResult


class EmailProviderAdapter(BaseAdapter):
    def test_connection(self) -> AdapterResult:
        return AdapterResult(ok=False, message="Live email sender verification is not connected. Configure and certify an outbound provider before activating delivery.")

    def provision(self, service) -> AdapterResult:
        return self._not_ready("provision")

    def suspend(self, service, reason=None) -> AdapterResult:
        return self._not_ready("suspend")

    def unsuspend(self, service) -> AdapterResult:
        return self._not_ready("unsuspend")

    def terminate(self, service) -> AdapterResult:
        return self._not_ready("terminate")

    def fetch_usage(self, service) -> AdapterResult:
        return self._not_ready("fetch_usage")
