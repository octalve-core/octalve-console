from .base import BaseAdapter
from ..contracts import AdapterResult


class DomainRegistrarAdapter(BaseAdapter):
    def test_connection(self) -> AdapterResult:
        return AdapterResult(ok=True, message="DomainRegistrarAdapter configuration accepted. Real API call should be implemented by backend developer.")

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
