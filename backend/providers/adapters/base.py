# providers/adapters/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Any, Optional
from decimal import Decimal
import requests
import json
from django.utils import timezone
from django.conf import settings

@dataclass
class AdapterResult:
    """Standard result format for all adapter operations"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    status_code: Optional[int] = None
    duration_ms: Optional[int] = None


class BaseProviderAdapter(ABC):
    """Abstract base class for all provider adapters"""
    
    def __init__(self, provider):
        """
        Initialize adapter with provider instance
        """
        self.provider = provider
        self.base_url = provider.base_url.rstrip('/')
        self.timeout = provider.timeout_seconds or 30
        self.test_mode = provider.test_mode
    
    @abstractmethod
    def test_connection(self) -> AdapterResult:
        """Test connection to provider"""
        pass
    
    def _make_request(self, endpoint: str, method: str = 'GET', data: Dict = None, 
                      headers: Dict = None) -> AdapterResult:
        """
        Make HTTP request to provider API with logging
        """
        import time
        start_time = time.time()
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Prepare headers
        request_headers = self._get_headers()
        if headers:
            request_headers.update(headers)
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=request_headers,
                json=data if method != 'GET' else None,
                params=data if method == 'GET' else None,
                timeout=self.timeout
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Parse response
            try:
                response_data = response.json()
            except:
                response_data = {'text': response.text}
            
            # Log the request (save to database)
            self._log_request(
                endpoint=endpoint,
                method=method,
                request_body=data,
                status_code=response.status_code,
                response_body=response_data,
                success=response.ok,
                duration_ms=duration_ms
            )
            
            if response.ok:
                return AdapterResult(
                    success=True,
                    data=response_data,
                    status_code=response.status_code,
                    duration_ms=duration_ms
                )
            else:
                return AdapterResult(
                    success=False,
                    error=response_data.get('message', response.text),
                    status_code=response.status_code,
                    duration_ms=duration_ms
                )
                
        except requests.exceptions.Timeout:
            return AdapterResult(
                success=False,
                error=f"Request timeout after {self.timeout} seconds"
            )
        except requests.exceptions.ConnectionError:
            return AdapterResult(
                success=False,
                error="Connection error - cannot reach provider"
            )
        except Exception as e:
            return AdapterResult(
                success=False,
                error=str(e)
            )
    
    def _log_request(self, endpoint: str, method: str, request_body: Dict,
                     status_code: int, response_body: Dict, success: bool, duration_ms: int):
        """Log request to database"""
        from providers.models import ProviderLog
        
        ProviderLog.objects.create(
            provider=self.provider,
            action=endpoint.split('/')[0] if '/' in endpoint else endpoint,
            endpoint=endpoint,
            method=method,
            # Provider payloads contain passwords, access keys and personal data.
            request_body='[redacted]' if request_body else '',
            status_code=status_code,
            response_body='[redacted]' if response_body else '',
            success=success,
            duration_ms=duration_ms
        )
    
    def _get_headers(self) -> Dict:
        """Get headers for API request - override in child classes"""
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }


class ServerProviderAdapter(BaseProviderAdapter):
    """Adapter for server/hosting providers (DirectAdmin, cPanel, Plesk, etc.)"""
    
    @abstractmethod
    def provision(self, service_data: Dict) -> AdapterResult:
        """Provision a new service account"""
        pass
    
    @abstractmethod
    def suspend(self, service_identifier: str, reason: str = None) -> AdapterResult:
        """Suspend an existing service"""
        pass
    
    @abstractmethod
    def unsuspend(self, service_identifier: str) -> AdapterResult:
        """Unsuspend a suspended service"""
        pass
    
    @abstractmethod
    def terminate(self, service_identifier: str) -> AdapterResult:
        """Terminate/delete a service"""
        pass
    
    @abstractmethod
    def change_package(self, service_identifier: str, new_package: str) -> AdapterResult:
        """Change service package/plan"""
        pass
    
    @abstractmethod
    def change_password(self, service_identifier: str, new_password: str) -> AdapterResult:
        """Change service password"""
        pass
    
    @abstractmethod
    def fetch_usage(self, service_identifier: str) -> AdapterResult:
        """Fetch current usage (disk, bandwidth, etc.)"""
        pass
    
    @abstractmethod
    def fetch_login_url(self, service_identifier: str) -> AdapterResult:
        """Get control panel login URL"""
        pass


class DomainProviderAdapter(BaseProviderAdapter):
    """Adapter for domain registrars"""
    
    @abstractmethod
    def check_availability(self, domain: str) -> AdapterResult:
        """Check if domain is available for registration"""
        pass
    
    @abstractmethod
    def register(self, domain: str, years: int = 1, contacts: Dict = None) -> AdapterResult:
        """Register a domain"""
        pass
    
    @abstractmethod
    def transfer(self, domain: str, epp_code: str) -> AdapterResult:
        """Transfer domain to this registrar"""
        pass
    
    @abstractmethod
    def renew(self, domain: str, years: int = 1) -> AdapterResult:
        """Renew a domain"""
        pass
    
    @abstractmethod
    def update_nameservers(self, domain: str, nameservers: list) -> AdapterResult:
        """Update domain nameservers"""
        pass


class PaymentGatewayAdapter(BaseProviderAdapter):
    """Adapter for payment gateways"""
    
    @abstractmethod
    def initialize_payment(self, invoice_data: Dict, customer_data: Dict) -> AdapterResult:
        """Initialize payment and get authorization URL"""
        pass
    
    @abstractmethod
    def verify_payment(self, reference: str) -> AdapterResult:
        """Verify payment status"""
        pass
    
    @abstractmethod
    def handle_webhook(self, payload: Dict, headers: Dict) -> AdapterResult:
        """Process webhook notification"""
        pass

