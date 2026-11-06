"""DNS-01 security acceptance: isolated fixtures only, no external provider calls."""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from domains.models import Domain, DomainDNSBinding
from providers.connection_models import IntegrationConnection
from providers.cloudflare_int01 import CloudflareINT01, CloudflareINT01Denied

ACCOUNT = "a" * 32
ZONE = "b" * 32
NAME = "my-company.example.com"
SYNTHETIC = {
    "zone_name": NAME,
    "nameservers": ["anna.ns.cloudflare.com", "bob.ns.cloudflare.com"],
    "records": [{"id": "c" * 32, "name": NAME, "type": "A",
                 "value": "192.0.2.44", "ttl": 300, "proxied": True,
                 "priority": None}],
    "record_count": 1,
    "snapshot_sha256": "d" * 64,
    "read_only": True,
}


@override_settings(CLOUD_DNS01_READONLY_ENABLED=True)
class DNSCustomerAuthorityTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(
            username="dns-owner", email="dns-owner@example.invalid",
            role="client", password="SYNTHETIC-PASSWORD-2026"
        )
        self.other = users.objects.create_user(
            username="dns-foreign", email="dns-foreign@example.invalid",
            role="client", password="SYNTHETIC-PASSWORD-2026"
        )
        self.admin = users.objects.create_user(
            username="dns-superadmin", email="dns-superadmin@example.invalid",
            role="admin", is_staff=True, is_superuser=True,
            email_verified_at=timezone.now(), password="SYNTHETIC-PASSWORD-2026"
        )
        due = timezone.now() + timedelta(days=300)
        self.domain = Domain.objects.create(
            client=self.owner, domain_name=NAME, tld=".com",
            status="active", expiry_date=due, next_due_date=due
        )
        self.foreign = Domain.objects.create(
            client=self.other, domain_name="foreign.example.com", tld=".com",
            status="active", expiry_date=due, next_due_date=due
        )
        self.conn = IntegrationConnection.objects.create(
            adapter_key="cloudflare-dns", label="Synthetic DNS", environment="live",
            state="draft", public_settings={"account_id": ACCOUNT, "zone_id": ZONE},
            current_version=1, created_by=self.admin,
        )
        self.api = APIClient()
        self.url = f"/api/domains/domains/{self.domain.pk}/"

    def as_user(self, user):
        self.api.force_authenticate(user=user)
        return self.api

    def prepare(self):
        return self.api.post(self.url + "dns-prepare/", {
            "connection_id": str(self.conn.pk),
            "authorization_reference": "SUPPORT-OWNER-CONSENT-0001",
            "confirm_password": "TEST-ONLY",
            "totp_code": "123456",
        }, format="json")

    def grant(self):
        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly.check_mutation"), \
             patch("domains.dns_readonly._conn") as connector:
            connector.return_value.dns_live_inventory.return_value = SYNTHETIC
            self.as_user(self.admin)
            prepared = self.prepare()
            self.assertEqual(prepared.status_code, 201, prepared.data)
            self.as_user(self.owner)
            consented = self.api.post(self.url + "dns-consent/",
                {"accept": True, "consent_version": "dns-read-v1"}, format="json")
            self.assertEqual(consented.status_code, 200, consented.data)
            self.as_user(self.admin)
            approved = self.api.post(self.url + "dns-approve/",
                {"confirm_password": "TEST-ONLY", "totp_code": "654321"}, format="json")
            self.assertEqual(approved.status_code, 200, approved.data)

    def test_anonymous_foreign_staff_and_client_approval_are_rejected(self):
        self.api.force_authenticate(user=None)
        self.assertIn(self.api.get(self.url + "live-dns/").status_code, (401, 403))
        self.as_user(self.other)
        for route in ("live-dns/", "dns-access/", "dns-consent/", "dns-revoke/"):
            if route in ("dns-consent/", "dns-revoke/"):
                result = self.api.post(self.url + route, {}, format="json")
            else:
                result = self.api.get(self.url + route)
            self.assertEqual(result.status_code, 404, (route, result.data))
        self.as_user(self.owner)
        self.assertEqual(self.api.post(self.url+"dns-approve/", {}, format="json").status_code, 403)
        self.assertEqual(self.api.post(self.url+"dns-prepare/", {}, format="json").status_code, 403)
        staff = get_user_model().objects.create_user(
            username="dns-staff", email="dns-staff@example.invalid",
            role="staff", is_staff=True, password="SYNTHETIC-PASSWORD-2026")
        self.as_user(staff)
        self.assertEqual(self.api.get(self.url+"live-dns/").status_code, 404)

    def test_no_customer_consent_no_live_dns_and_no_provider_call(self):
        self.as_user(self.owner)
        r = self.api.get(self.url+"live-dns/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["state"], "not_connected")
        self.assertEqual(r.data["records"], [])
        self.assertEqual(self.api.post(self.url+"dns-consent/",
                          {"accept": True,"consent_version":"dns-read-v1"},
                          format="json").status_code, 409)

        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly.check_mutation"), \
             patch("domains.dns_readonly._conn") as connector:
            connector.return_value.dns_live_inventory.return_value = SYNTHETIC
            self.as_user(self.admin)
            self.assertEqual(self.prepare().status_code, 201)
            self.assertEqual(self.api.post(self.url+"dns-approve/",
                {"confirm_password":"TEST","totp_code":"123456"},format="json").status_code,409)
            self.as_user(self.owner)
            r = self.api.get(self.url+"live-dns/")
            self.assertEqual(r.data["state"], "awaiting_customer_approval")
            self.assertEqual(r.data["records"], [])

    def test_prepared_customer_approval_live_data_and_revocation(self):
        self.grant()
        binding = DomainDNSBinding.objects.get(domain=self.domain)
        self.assertEqual(binding.state, "active")
        self.assertEqual(binding.credential_version, 1)
        self.as_user(self.other)
        self.assertEqual(self.api.get(self.url+"live-dns/").status_code, 404)
        self.as_user(self.owner)
        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly._conn") as supplier, \
             patch("domains.dns_readonly.spend_durable_auth_attempt", return_value=0):
            supplier.return_value.dns_live_inventory.return_value = SYNTHETIC
            live = self.api.get(self.url+"live-dns/")
        self.assertEqual(live.status_code, 200, live.data)
        self.assertEqual(live.data["record_count"], 1)
        self.assertEqual(live.data["records"][0]["value"], "192.0.2.44")
        self.assertFalse(live.data["execution_enabled"])
        self.assertNotIn(ACCOUNT, str(live.data))
        self.assertNotIn(ZONE, str(live.data))
        self.assertNotIn("api_token", str(live.data))
        self.assertIn("no-store", live["Cache-Control"])
        revoked = self.api.post(self.url+"dns-revoke/",{},format="json")
        self.assertEqual(revoked.data["state"], "revoked")
        self.assertEqual(self.api.get(self.url+"live-dns/").data["records"], [])

    def test_provider_rotation_and_revocation_cannot_reuse_authorization(self):
        self.grant()
        self.as_user(self.owner)
        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly.spend_durable_auth_attempt", return_value=0):
            self.conn.current_version = 2
            self.conn.save(update_fields=["current_version","updated_at"])
            result = self.api.get(self.url+"live-dns/")
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.data["records"], [])
            self.conn.state = "revoked"
            self.conn.save(update_fields=["state"])
            result = self.api.get(self.url+"live-dns/")
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.data["records"], [])

    def test_dns01_release_switch_fails_closed_even_for_authorized_owner(self):
        self.grant()
        self.as_user(self.owner)
        with self.settings(CLOUD_DNS01_READONLY_ENABLED=False), \
             patch("domains.dns_readonly._conn") as supplier:
            for action in ("live-dns/", "dns-access/"):
                response = self.api.get(self.url + action)
                self.assertEqual(response.status_code, 503)
            supplier.assert_not_called()

    def test_stale_credential_can_rebind_only_with_new_customer_consent(self):
        self.grant()
        self.conn.current_version = 2
        self.conn.save(update_fields=["current_version", "updated_at"])
        self.as_user(self.admin)
        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly.check_mutation"), \
             patch("domains.dns_readonly._conn") as supplier:
            supplier.return_value.dns_live_inventory.return_value = SYNTHETIC
            again = self.prepare()
        self.assertEqual(again.status_code, 201, again.data)
        binding = DomainDNSBinding.objects.get(domain=self.domain)
        self.assertEqual(binding.state, "pending")
        self.assertEqual(binding.credential_version, 2)
        self.assertIsNone(binding.consented_at)
        self.assertIsNone(binding.consented_by_id)
        self.assertIsNone(binding.approved_at)
        self.as_user(self.owner)
        response = self.api.get(self.url + "live-dns/")
        self.assertEqual(response.data["state"], "awaiting_customer_approval")
        self.assertEqual(response.data["records"], [])

    def test_wrong_zone_token_cannot_be_bound_to_unrelated_customer(self):
        self.as_user(self.admin)
        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly.check_mutation"), \
             patch("domains.dns_readonly._conn") as supplier:
            supplier.return_value.dns_live_inventory.side_effect = CloudflareINT01Denied()
            result = self.prepare()
        self.assertEqual(result.status_code, 503)
        self.assertFalse(DomainDNSBinding.objects.exists())


    def test_customer_transfer_invalidates_previous_consent_and_provider_read(self):
        self.grant()
        self.domain.client = self.other
        self.domain.save(update_fields=["client", "updated_at"])
        self.as_user(self.owner)
        self.assertEqual(self.api.get(self.url+"live-dns/").status_code, 404)
        self.as_user(self.other)
        status = self.api.get(self.url+"dns-access/")
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.data["state"], "recheck_required")
        with patch("domains.dns_readonly._conn") as supplier:
            live = self.api.get(self.url+"live-dns/")
        self.assertEqual(live.status_code, 503, live.data)
        supplier.assert_not_called()
        original = DomainDNSBinding.objects.get(domain=self.domain)
        self.assertEqual(original.client_id, self.owner.pk)
        self.assertEqual(original.consented_by_id, self.owner.pk)

    def test_revocation_during_supplier_fetch_discards_all_inflight_records(self):
        self.grant()
        self.as_user(self.owner)
        def revoke_while_reading(*args, **kwargs):
            DomainDNSBinding.objects.filter(domain=self.domain).update(
                state="revoked", consented_at=None, consented_by=None,
                approved_at=None, approved_by=None, updated_at=timezone.now(),
            )
            return SYNTHETIC
        with patch("domains.dns_readonly._vault_read_ready"), \
             patch("domains.dns_readonly.spend_durable_auth_attempt", return_value=0), \
             patch("domains.dns_readonly._conn") as supplier:
            supplier.return_value.dns_live_inventory.side_effect = revoke_while_reading
            result = self.api.get(self.url+"live-dns/")
        self.assertEqual(result.status_code, 409, result.data)
        self.assertEqual(result.data["records"], [])
        self.assertNotIn("192.0.2.44", str(result.data))

    def test_malformed_connection_id_fails_before_provider_egress(self):
        self.as_user(self.admin)
        data = {
            "connection_id": "----" + "a"*32,
            "authorization_reference": "SUPPORT-OWNER-CONSENT-0001",
            "confirm_password": "TEST-ONLY",
            "totp_code": "123456",
        }
        with patch("domains.dns_readonly._conn") as supplier:
            result = self.api.post(self.url+"dns-prepare/", data, format="json")
        self.assertEqual(result.status_code, 400)
        supplier.assert_not_called()


class SyntheticCloudflareDNSInventoryTests(SimpleTestCase):
    def transport(self, zone_name=NAME, account=ACCOUNT, records=None, ttl=300,
                  nameservers=None):
        rows = [{"id":"c"*32,"name":zone_name,"type":"A",
                 "content":"192.0.2.44","ttl":ttl,"proxied":True}]
        if records is not None: rows = records
        calls=[]
        def get(method,path,body=None):
            calls.append((method,path,body))
            if path==f"/zones/{ZONE}":
                return {"success":True,"errors":[],"result":{
                    "id":ZONE,"name":zone_name,"status":"active",
                    "account":{"id":account},"name_servers":nameservers if nameservers is not None
                    else ["anna.ns.cloudflare.com","bob.ns.cloudflare.com"]}}
            if path==f"/zones/{ZONE}/dns_records?page=1&per_page=100":
                return {"success":True,"errors":[],"result":rows,
                        "result_info":{"count":len(rows),"page":1,"per_page":100,
                                       "total_count":len(rows),"total_pages":1}}
            raise AssertionError("Unexpected call")
        return get,calls

    def test_exact_zone_account_and_complete_provider_records(self):
        transport,calls=self.transport()
        result=CloudflareINT01(ACCOUNT,transport).dns_live_inventory(ZONE,NAME)
        self.assertEqual(result["record_count"],1)
        self.assertEqual(result["records"][0]["ttl"],300)
        self.assertTrue(result["records"][0]["proxied"])
        self.assertEqual([row[0] for row in calls],["GET","GET"])
        for kw in ({"zone_name":"not-owned.example.com"}, {"account":"d"*32},
                   {"nameservers":[]}, {"ttl":17}):
            transport,_=self.transport(**kw)
            with self.subTest(kw=kw),self.assertRaises(CloudflareINT01Denied):
                CloudflareINT01(ACCOUNT,transport).dns_live_inventory(ZONE,NAME)
        for records in (
            [{"id":"c"*32,"name":"foreign.example.com","type":"A",
              "content":"192.0.2.3","ttl":300}],
            [{"id":"c"*32,"name":NAME,"type":"A",
              "content":"192.0.2.3","ttl":300}]*2,
        ):
            with self.subTest(records=records),self.assertRaises(CloudflareINT01Denied):
                transport,_=self.transport(records=records)
                CloudflareINT01(ACCOUNT,transport).dns_live_inventory(ZONE,NAME)

    def test_read_only_transport_never_accepts_mutating_dns_requests(self):
        from providers.cloudflare_int01 import FixedCloudflareTransport
        transport=FixedCloudflareTransport("SYNTHETIC_DNS_TOKEN_1234567890")
        for method,path in (
            ("POST",f"/zones/{ZONE}/dns_records"),
            ("PUT",f"/zones/{ZONE}/dns_records/{'c'*32}"),
            ("DELETE",f"/zones/{ZONE}/dns_records/{'c'*32}"),
        ):
            with self.subTest(method=method),self.assertRaises(CloudflareINT01Denied):
                transport(method,path,{"type":"A"})
