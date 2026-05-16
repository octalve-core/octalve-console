# providers/adapters/directadmin.py

import base64
import requests
from .base import ServerProviderAdapter, AdapterResult

from typing import Dict

class DirectAdminAdapter(ServerProviderAdapter):
    """DirectAdmin hosting control panel adapter"""
    
    def __init__(self, provider):
        super().__init__(provider)
        self.username = provider.username
        self.api_key = provider.get_api_key()
        
    def _get_headers(self):
        """DirectAdmin uses Basic Auth"""
        headers = super()._get_headers()
        
        auth_string = f"{self.username}:{self.api_key}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()
        headers['Authorization'] = f'Basic {encoded_auth}'
        
        return headers
    
    def test_connection(self) -> AdapterResult:
        """Test connection to DirectAdmin"""
        result = self._make_request('API/HELLO', method='GET')
        if result.success and result.data and 'error' not in str(result.data).lower():
            self.provider.update_health(True, "Connection successful")
            return AdapterResult(success=True, data={'message': 'Connected successfully'})
        else:
            self.provider.update_health(False, str(result.error))
            return AdapterResult(success=False, error="Connection failed")
    
    def provision(self, service_data: Dict) -> AdapterResult:
        """
        Provision a new user account in DirectAdmin
        
        Expected service_data:
        - username: str (8-10 chars)
        - password: str
        - domain: str
        - package: str (package name in DA)
        - email: str
        - name: str (full name)
        """
        endpoint = 'CMD_API_ACCOUNT_USER'
        
        data = {
            'action': 'create',
            'username': service_data.get('username'),
            'passwd': service_data.get('password'),
            'passwd2': service_data.get('password'),
            'domain': service_data.get('domain'),
            'package': service_data.get('package'),
            'email': service_data.get('email'),
            'name': service_data.get('name', ''),
            'notify': 'no',
            'add': 'Submit',
        }
        
        result = self._make_request(endpoint, method='POST', data=data)
        
        if result.success:
            return AdapterResult(
                success=True,
                data={
                    'username': service_data.get('username'),
                    'domain': service_data.get('domain'),
                    'message': 'Account created successfully'
                }
            )
        else:
            return AdapterResult(
                success=False,
                error=result.error or 'Failed to create account'
            )
    
    def suspend(self, service_identifier: str, reason: str = None) -> AdapterResult:
        """Suspend a user account"""
        endpoint = 'CMD_API_SELECT_USERS'
        data = {
            'suspend': 'Suspend',
            'select0': service_identifier,
        }
        
        result = self._make_request(endpoint, method='POST', data=data)
        
        if result.success:
            return AdapterResult(success=True, data={'suspended': True})
        return AdapterResult(success=False, error=f"Failed to suspend {service_identifier}")
    
    def unsuspend(self, service_identifier: str) -> AdapterResult:
        """Unsuspend a user account"""
        endpoint = 'CMD_API_SELECT_USERS'
        data = {
            'unsuspend': 'Unsuspend',
            'select0': service_identifier,
        }
        
        result = self._make_request(endpoint, method='POST', data=data)
        
        if result.success:
            return AdapterResult(success=True, data={'unsuspended': True})
        return AdapterResult(success=False, error=f"Failed to unsuspend {service_identifier}")
    
    def terminate(self, service_identifier: str) -> AdapterResult:
        """Terminate/delete a user account"""
        endpoint = 'CMD_API_SELECT_USERS'
        data = {
            'delete': 'Yes',
            'select0': service_identifier,
        }
        
        result = self._make_request(endpoint, method='POST', data=data)
        
        if result.success:
            return AdapterResult(success=True, data={'terminated': True})
        return AdapterResult(success=False, error=f"Failed to terminate {service_identifier}")
    
    def change_package(self, service_identifier: str, new_package: str) -> AdapterResult:
        """Change user package"""
        endpoint = 'CMD_API_MODIFY_USER'
        data = {
            'username': service_identifier,
            'package': new_package,
        }
        
        result = self._make_request(endpoint, method='POST', data=data)
        
        if result.success:
            return AdapterResult(success=True, data={'package_changed': new_package})
        return AdapterResult(success=False, error=f"Failed to change package for {service_identifier}")
    
    def change_password(self, service_identifier: str, new_password: str) -> AdapterResult:
        """Change user password"""
        endpoint = 'CMD_API_USER_PASSWD'
        data = {
            'username': service_identifier,
            'passwd': new_password,
            'passwd2': new_password,
        }
        
        result = self._make_request(endpoint, method='POST', data=data)
        
        if result.success:
            return AdapterResult(success=True, data={'password_changed': True})
        return AdapterResult(success=False, error=f"Failed to change password for {service_identifier}")
    
    def fetch_usage(self, service_identifier: str) -> AdapterResult:
        """Fetch user usage statistics"""
        endpoint = f"CMD_API_SHOW_USER_USAGE?user={service_identifier}"
        
        result = self._make_request(endpoint, method='GET')
        
        if result.success and result.data:
            usage_data = {
                'disk_used': result.data.get('bandwidth', {}).get('disk_used', 0),
                'disk_limit': result.data.get('bandwidth', {}).get('disk_limit', 0),
                'bandwidth_used': result.data.get('bandwidth', {}).get('bandwidth_used', 0),
                'bandwidth_limit': result.data.get('bandwidth', {}).get('bandwidth_limit', 0),
            }
            return AdapterResult(success=True, data=usage_data)
        return AdapterResult(success=False, error="Failed to fetch usage")
    
    def fetch_login_url(self, service_identifier: str) -> AdapterResult:
        """Get DirectAdmin login URL"""
        # DirectAdmin doesn't have a direct API for this
        # Return the base URL with username
        login_url = f"{self.base_url}:2222"
        return AdapterResult(success=True, data={'login_url': login_url})
