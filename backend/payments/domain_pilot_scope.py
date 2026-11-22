"""Narrow payment authority for the operator's sandbox domain purchase."""
import os

from django.conf import settings

from providers.cloudflare_int01 import DOMAIN

PILOT = "sandbox_domain_purchase"


def pilot_configuration():
    account = os.getenv("CLOUD_DOMAIN_PILOT_CLIENT_ID", "")
    domain = os.getenv("CLOUD_DOMAIN_PILOT_NAME", "")
    if (os.getenv("CLOUD_DOMAIN_PILOT_ENABLED") != "true"
            or not account.isascii() or not account.isdecimal()
            or not 1 <= len(account) <= 18 or account.startswith("0")
            or not DOMAIN.fullmatch(domain) or not domain.endswith(".com")):
        return None
    return int(account), domain


def is_pilot_invoice(invoice):
    metadata = getattr(invoice, "metadata", None)
    return isinstance(metadata, dict) and metadata.get(PILOT) is True


def selected_domain_test_allowed(client, domain):
    return bool(
        getattr(settings, "CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED", False)
        and client.is_active and client.role == "client" and client.email_verified_at is not None
        and str(client.pk) == os.getenv("CLOUD_DOMAIN_PILOT_CLIENT_ID", "")
        and isinstance(domain, str) and domain.endswith(".com") and DOMAIN.fullmatch(domain)
    )


def pilot_gateway_allowed(gateway, invoice):
    scope = pilot_configuration()
    if not is_pilot_invoice(invoice) or not invoice.order_id:
        return False
    order = invoice.order
    snapshot = order.metadata.get(PILOT)
    if not isinstance(snapshot, dict):
        return False
    allowed = (selected_domain_test_allowed(invoice.client, snapshot.get("domain"))
               if snapshot.get("selected_domain") is True
               else (invoice.client_id, snapshot.get("domain")) == scope)
    return bool(allowed
                and order.client_id == invoice.client_id
                and invoice.client.is_active and invoice.client.role == "client"
                and invoice.client.email_verified_at is not None
                and pilot_test_gateway(gateway))


def pilot_test_gateway(gateway):
    return bool(gateway.code == "paystack" and gateway.test_mode
                and gateway.status == "test" and not gateway.encrypted_secret_key
                and isinstance(gateway.config, dict)
                and "provider_vault_connection_id" in gateway.config)
