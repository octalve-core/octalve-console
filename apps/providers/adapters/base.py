from ..contracts import AdapterResult


class BaseAdapter:
    def __init__(self, config: dict):
        self.config = config

    def test_connection(self) -> AdapterResult:
        return AdapterResult(ok=False, message="Adapter connection test not implemented yet.")

    def _not_ready(self, action: str) -> AdapterResult:
        return AdapterResult(ok=False, message=f"{self.__class__.__name__}.{action} is not implemented yet.", retryable=False)
