"""DNS-01C: isolated tenant, Cloudflare proof and registrar-truth acceptance."""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from domains.external_dns_claims import (
    CHALLENGE_PREFIX, _contains_exact_proof,
)
from domains.models import Domain, DomainDNSBinding, DomainDNSClaim
from providers.connection_models import IntegrationConnection

ACCOUNT = "a" * 32
ZONE = "b" * 32
NAME = "external-example.com"


@override_settings(
    CLOUD_DNS01_READONLY_ENABLED=True,
    CLOUD_DNS01_EXTERNAL_CLAIMS_ENABLED=True,
)
class ExternalDNSClaimTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(
            username="external-owner", email="external-owner@example.invalid",
            password="SYNTHETIC-PASSWORD-01", role="client",
            email_verified_at=timezone.now(),
        )
        self.foreign = User.objects.create_user(
            username="external-foreign", email="external-foreign@example.invalid",
            password="SYNTHETIC-PASSWORD-02", role="client",
            email_verified_at=timezone.now(),
        )
        self.admin = User.objects.create_user(
            username="external-admin", email="external-admin@example.invalid",
            password="SYNTHETIC-PASSWORD-03", role="admin",
            is_superuser=True, is_staff=True, email_verified_at=timezone.now(),
        )
        self.staff = User.objects.create_user(
            username="external-staff", email="external-staff@example.invalid",
            password="SYNTHETIC-PASSWORD-04", role="staff", is_staff=True,
        )
        self.conn = IntegrationConnection.objects.create(
            adapter_key="cloudflare-dns", label="External zone",
            environment="live", state="draft",
            public_settings={"account_id": ACCOUNT, "zone_id": ZONE},
            current_version=1, created_by=self.admin,
        )
        self.api = APIClient()
        self.url = "/api/domains/domains/"

    def as_user(self, user):
        self.api.force_authenticate(user=user)

    def begin(self, name=NAME):
        with patch("domains.external_dns_claims._rate"):
            return self.api.post(self.url+"dns-only-claim/",
                                 {"domain_name": name}, format="json")

    def issue(self):
        self.as_user(self.owner)
        result = self.begin()
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["challenge"]["name"], CHALLENGE_PREFIX+NAME)
        self.assertFalse(result.data["registration_confirmed"])
        self.assertFalse(result.data["execution_enabled"])
        self.assertIn("no-store", result["Cache-Control"])
        claim = DomainDNSClaim.objects.get(pk=result.data["id"])
        self.assertNotIn(result.data["challenge"]["value"], claim.challenge_sha256)
        return result

    def proof(self, token):
        return {"zone_name": NAME, "read_only": True,
                "records": [{"id": "c"*32, "type": "TXT",
                             "name": CHALLENGE_PREFIX+NAME, "value": token,
                             "ttl": 300, "proxied": None, "priority": None}],
                "record_count": 1}

    def verify(self, claim_id, snapshot, **body):
        self.as_user(self.admin)
        data = {
            "claim_id": claim_id,
            "connection_id": str(self.conn.pk),
            "confirm_password": "SYNTHETIC-PASSWORD-03",
            "totp_code": "123456",
            **body,
        }
        with patch("domains.external_dns_claims._rate"), \
             patch("domains.external_dns_claims._vault_read_ready"), \
             patch("domains.external_dns_claims.check_mutation"), \
             patch("domains.external_dns_claims._conn") as connector:
            connector.return_value.dns_live_inventory.return_value = snapshot
            result = self.api.post(self.url+"dns-only-verify/", data, format="json")
        return result

    def test_customer_create_does_not_manufacture_domain_or_registry_dates(self):
        issued = self.issue()
        self.assertFalse(Domain.objects.exists())
        self.assertFalse(DomainDNSBinding.objects.exists())
        claims = self.api.get(self.url+"dns-only-claims/")
        self.assertEqual(claims.status_code, 200)
        self.assertEqual(len(claims.data["results"]), 1)
        self.assertNotIn("challenge", str(claims.data))
        self.assertNotIn(issued.data["challenge"]["value"], str(claims.data))

    def test_verified_zone_claim_makes_dns_only_domain_without_purchase(self):
        issued = self.issue()
        confirmed = self.verify(issued.data["id"],
                                self.proof(issued.data["challenge"]["value"]))
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        domain = Domain.objects.get(domain_name=NAME)
        self.assertEqual(domain.client_id, self.owner.pk)
        self.assertEqual(domain.management_kind, "dns_only")
        self.assertEqual(domain.status, "dns_only")
        self.assertEqual(domain.registration_type, "dns_only")
        self.assertFalse(domain.auto_renew)
        self.assertIsNone(domain.registration_date)
        self.assertIsNone(domain.expiry_date)
        self.assertIsNone(domain.next_due_date)
        self.assertIsNone(domain.registrar)
        self.assertIsNone(domain.order_item_id)
        bind = DomainDNSBinding.objects.get(domain=domain)
        self.assertEqual(bind.state, "pending")
        self.assertEqual(bind.client_id, self.owner.pk)
        self.assertEqual(bind.credential_version, 1)
        self.assertIsNone(bind.consented_at)
        self.as_user(self.foreign)
        self.assertEqual(self.api.get(self.url+f"{domain.pk}/").status_code, 404)
        self.assertEqual(self.api.get(self.url+f"{domain.pk}/live-dns/").status_code, 404)
        self.as_user(self.owner)
        status = self.api.get(self.url+f"{domain.pk}/dns-access/")
        self.assertEqual(status.data["state"], "awaiting_customer_approval")
        renewal = self.api.get(self.url+f"{domain.pk}/renewal-status/")
        self.assertEqual(renewal.status_code, 200)
        self.assertEqual(renewal.data["state"], "unavailable")
        self.assertIsNone(renewal.data["expiry_date"])
        self.assertFalse(renewal.data["registration_confirmed"])
        self.assertEqual(self.api.post(self.url+"", {}, format="json").status_code, 503)

    def test_foreign_customer_cannot_take_another_claim_or_proof(self):
        issued = self.issue()
        self.as_user(self.foreign)
        result = self.begin()
        self.assertEqual(result.status_code, 409)
        own = self.api.get(self.url+"dns-only-claims/")
        self.assertEqual(own.data["results"], [])
        self.assertEqual(self.api.post(self.url+"dns-only-verify/", {}, format="json").status_code, 403)
        self.as_user(self.staff)
        self.assertEqual(self.api.get(self.url+"dns-only-claims/").status_code, 403)
        self.assertEqual(self.api.post(self.url+"dns-only-verify/", {}, format="json").status_code, 403)
        self.assertFalse(Domain.objects.exists())

    def test_provider_must_reveal_exact_one_time_txt_proof(self):
        issued = self.issue()
        claim_id = issued.data["id"]
        value = issued.data["challenge"]["value"]
        for snapshot in (
            self.proof("octalve-verify=wrong"),
            {"zone_name": "unrelated-domain.com", "read_only": True,
             "records": self.proof(value)["records"]},
            {"zone_name": NAME, "read_only": True,
             "records": [{"type": "TXT", "name": "_octalve-verify.not-ours.com",
                          "value": value}]},
        ):
            with self.subTest(snapshot=snapshot):
                result = self.verify(claim_id, snapshot)
                self.assertEqual(result.status_code, 409, result.data)
                self.assertFalse(Domain.objects.exists())
        self.assertFalse(_contains_exact_proof(
            self.proof("octalve-verify=wrong"), NAME,
            DomainDNSClaim.objects.get(pk=claim_id).challenge_sha256))

    def test_expired_proof_and_rotated_credentials_fail_closed(self):
        issued = self.issue()
        claim = DomainDNSClaim.objects.get(pk=issued.data["id"])
        claim.expires_at = timezone.now()-timedelta(seconds=1)
        claim.save(update_fields=["expires_at"])
        self.assertEqual(self.verify(str(claim.pk),
            self.proof(issued.data["challenge"]["value"])).status_code, 409)
        self.assertFalse(Domain.objects.exists())
        claim.expires_at = timezone.now()+timedelta(minutes=10)
        claim.save(update_fields=["expires_at"])
        def rotate(*_a, **_kw):
            self.conn.current_version = 2
            self.conn.save(update_fields=["current_version", "updated_at"])
            return self.proof(issued.data["challenge"]["value"])
        self.as_user(self.admin)
        with patch("domains.external_dns_claims._rate"), \
             patch("domains.external_dns_claims._vault_read_ready"), \
             patch("domains.external_dns_claims.check_mutation"), \
             patch("domains.external_dns_claims._conn") as supplier:
            supplier.return_value.dns_live_inventory.side_effect = rotate
            response = self.api.post(self.url+"dns-only-verify/", {
                "claim_id": str(claim.pk), "connection_id": str(self.conn.pk),
                "confirm_password": "TEST", "totp_code": "123456",
            }, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertFalse(Domain.objects.exists())

    def test_disabled_flags_refuse_before_database_or_provider_read(self):
        with self.settings(CLOUD_DNS01_EXTERNAL_CLAIMS_ENABLED=False):
            self.as_user(self.owner)
            self.assertEqual(self.begin().status_code, 503)
            self.assertEqual(self.api.get(self.url+"dns-only-claims/").status_code, 503)
            self.as_user(self.admin)
            self.assertEqual(self.verify("bad", {}).status_code, 503)
        self.assertFalse(DomainDNSClaim.objects.exists())

    def test_dns_only_domain_rejects_fabricated_registry_details(self):
        with self.assertRaisesRegex(ValueError, "DNS-only domains"):
            Domain.objects.create(
                client=self.owner, domain_name=NAME, tld=".com",
                status="active", management_kind="dns_only", registration_type="dns_only",
                expiry_date=timezone.now(), next_due_date=timezone.now(),
            )
        self.assertFalse(Domain.objects.exists())
