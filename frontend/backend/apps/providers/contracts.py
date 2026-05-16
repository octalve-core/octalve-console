from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class AdapterResult:
    ok: bool
    message: str
    provider_reference: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    retryable: bool = False


class ServerProviderAdapter:
    def test_connection(self) -> AdapterResult:
        raise NotImplementedError

    def provision(self, service: Any) -> AdapterResult:
        raise NotImplementedError

    def suspend(self, service: Any, reason: Optional[str] = None) -> AdapterResult:
        raise NotImplementedError

    def unsuspend(self, service: Any) -> AdapterResult:
        raise NotImplementedError

    def terminate(self, service: Any) -> AdapterResult:
        raise NotImplementedError

    def change_package(self, service: Any, new_plan: Any) -> AdapterResult:
        raise NotImplementedError

    def change_password(self, service: Any, new_password: str) -> AdapterResult:
        raise NotImplementedError

    def fetch_usage(self, service: Any) -> AdapterResult:
        raise NotImplementedError


class DomainProviderAdapter:
    def check_availability(self, domain: str) -> AdapterResult:
        raise NotImplementedError

    def register(self, domain_order: Any) -> AdapterResult:
        raise NotImplementedError

    def transfer(self, domain_order: Any) -> AdapterResult:
        raise NotImplementedError

    def renew(self, domain: Any) -> AdapterResult:
        raise NotImplementedError

    def update_nameservers(self, domain: Any, nameservers: list[str]) -> AdapterResult:
        raise NotImplementedError


class PaymentGatewayAdapter:
    def initialize_payment(self, invoice: Any, customer: Any) -> AdapterResult:
        raise NotImplementedError

    def verify_payment(self, reference: str) -> AdapterResult:
        raise NotImplementedError

    def handle_webhook(self, payload: Dict[str, Any], headers: Dict[str, str]) -> AdapterResult:
        raise NotImplementedError
