# Octalve Console Backend Adapter Architecture

## Purpose

The adapter system allows Octalve Console to connect to many infrastructure providers without locking the billing system to one provider.

Octalve Console can support DirectAdmin now, then later support cPanel, Plesk, Proxmox, Virtualizor, Enhance, Pterodactyl, VirtFusion, Cloudflare, domain registrars, SSL providers, email providers and backup providers.

## Core principle

Billing, orders and services should not directly call DirectAdmin, cPanel, Proxmox or any provider.

Instead, the system should call a common adapter contract.

Example:

```python
adapter.provision(service)
adapter.suspend(service)
adapter.unsuspend(service)
adapter.terminate(service)
adapter.fetch_usage(service)
```

## Adapter classes to support

```txt
DirectAdminAdapter
CpanelAdapter
PleskAdapter
VirtualizorAdapter
ProxmoxAdapter
CustomProviderAdapter
EnhanceAdapter
PterodactylAdapter
VirtFusionAdapter
CloudflareAdapter
DomainRegistrarAdapter
SslProviderAdapter
EmailProviderAdapter
BackupProviderAdapter
```

## Recommended backend directory

```txt
backend/
  config/
  apps/
    accounts/
    billing/
    catalog/
    orders/
    services/
    domains/
    support/
    wallet/
    audit/
    settings_registry/
    providers/
      contracts.py
      registry.py
      models.py
      adapters/
        base.py
        directadmin.py
        cpanel.py
        plesk.py
        proxmox.py
        virtualizor.py
        enhance.py
        pterodactyl.py
        virtfusion.py
        cloudflare.py
        domain_registrar.py
        ssl_provider.py
        email_provider.py
        backup_provider.py
        custom.py
```

## Provider model

A provider record should store:

- name
- adapter_type
- base_url
- username/api user
- encrypted secret/API key
- server group
- status
- test mode
- health status
- last health check
- metadata JSON

Secrets must be encrypted at rest.

## Adapter contract

Every server adapter should support as many of these operations as possible:

```python
class ServerProviderAdapter:
    def test_connection(self) -> AdapterResult: ...
    def provision(self, service) -> AdapterResult: ...
    def suspend(self, service, reason=None) -> AdapterResult: ...
    def unsuspend(self, service) -> AdapterResult: ...
    def terminate(self, service) -> AdapterResult: ...
    def change_package(self, service, new_plan) -> AdapterResult: ...
    def change_password(self, service, new_password) -> AdapterResult: ...
    def fetch_usage(self, service) -> AdapterResult: ...
    def fetch_login_url(self, service) -> AdapterResult: ...
```

Domain adapters:

```python
class DomainProviderAdapter:
    def check_availability(self, domain) -> AdapterResult: ...
    def register(self, domain_order) -> AdapterResult: ...
    def transfer(self, domain_order) -> AdapterResult: ...
    def renew(self, domain) -> AdapterResult: ...
    def update_nameservers(self, domain, nameservers) -> AdapterResult: ...
    def get_epp_code(self, domain) -> AdapterResult: ...
    def update_dns_record(self, domain, record) -> AdapterResult: ...
```

Gateway adapters:

```python
class PaymentGatewayAdapter:
    def initialize_payment(self, invoice, customer) -> AdapterResult: ...
    def verify_payment(self, reference) -> AdapterResult: ...
    def handle_webhook(self, payload, headers) -> AdapterResult: ...
    def refund(self, transaction) -> AdapterResult: ...
```

## Queue-first provisioning

Provisioning must run through a queue:

```txt
Order paid → ProvisioningTask created → Worker calls adapter → Service updated → Audit log written
```

Never rely on checkout request to provision directly. That creates timeout and data-consistency problems.

## Retry rules

- Network error: retry.
- Authentication error: do not retry until provider settings are fixed.
- Duplicate account: mark as needs review.
- Invalid package mapping: mark as configuration error.
- Provider timeout: retry with exponential backoff.

## DirectAdmin first milestone

The first real adapter should be DirectAdmin because Octalve Cloud currently plans to use DirectAdmin as the first hosting control panel.

Minimum DirectAdmin operations:

- test connection
- create user
- suspend user
- unsuspend user
- terminate user
- change package
- change password
- get usage
- generate login/control panel URL if supported

## Provider abstraction benefit

With this architecture, the same billing system can later provision:

- shared hosting through DirectAdmin/cPanel/Plesk/Enhance
- VPS through Proxmox/Virtualizor/VirtFusion/Convoy
- game servers through Pterodactyl
- DNS through Cloudflare
- domains through registrar adapters
- SSL certificates through SSL provider adapters
- mailboxes through email provider adapters
- backups through backup provider adapters
