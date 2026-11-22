"""Narrow payment authority for the operator's sandbox domain purchase."""
import os

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


def pilot_gateway_allowed(gateway, invoice):
    scope = pilot_configuration()
    if not scope or not is_pilot_invoice(invoice) or not invoice.order_id:
        return False
    order = invoice.order
    snapshot = order.metadata.get(PILOT)
    return bool(isinstance(snapshot, dict)
                and (invoice.client_id, snapshot.get("domain")) == scope
                and order.client_id == invoice.client_id
                and invoice.client.is_active and invoice.client.role == "client"
                and invoice.client.email_verified_at is not None
                and pilot_test_gateway(gateway))


def pilot_test_gateway(gateway):
    return bool(gateway.code == "paystack" and gateway.test_mode
                and gateway.status == "test" and not gateway.encrypted_secret_key
                and isinstance(gateway.config, dict)
                and "provider_vault_connection_id" in gateway.config)
