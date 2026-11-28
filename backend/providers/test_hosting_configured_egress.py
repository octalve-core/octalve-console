"""No network: validate the admin-configured hosting egress contract."""
import os
from unittest.mock import Mock,patch
from django.test import SimpleTestCase,override_settings
from rest_framework.exceptions import ValidationError
from providers.connection_specs import public_catalog,validate_public_settings
from providers.pinned_egress import approved_origin,pinned_get,SupplierEgressDenied
from providers.hosting_inventory import read_inventory
from types import SimpleNamespace


@override_settings(CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED=True,
                   CLOUD_SUPPLIER_PINNED_READBACK_ENABLED=True)
class ConfiguredHostingEgressTests(SimpleTestCase):
    def test_admin_schema_accepts_pinned_public_ip_without_per_server_env(self):
        with patch.dict(os.environ,{"CLOUD_CONNECTION_ALLOWED_HOSTS":"","CLOUD_INVENTORY_ALLOWED_HOSTS":""}):
            for adapter,port in (("directadmin",2222),("cpanel-whm",2087)):
                origin=f"https://panel.example.test:{port}"
                data={"server_url":origin,"username":"reseller","server_ip":"8.8.8.8"}
                self.assertEqual(validate_public_settings(adapter,data),data)
                schema=next(x for x in public_catalog() if x["key"]==adapter)
                self.assertEqual(schema["fields"]["server_ip"],"public_ip")
                self.assertFalse(schema["enabled_for_execution"])
                with self.assertRaises(ValidationError):
                    validate_public_settings(adapter,{"server_url":origin,"username":"reseller"})

    def test_private_special_and_transition_ips_are_refused(self):
        origin="https://panel.example.test:2087"
        for ip in ("127.0.0.1","10.0.0.1","172.16.0.1","192.168.0.1","169.254.169.254",
                   "100.64.0.1","0.0.0.0","224.0.0.1","192.0.2.1","::1",
                   "::ffff:8.8.8.8","64:ff9b::a9fe:a9fe","2002:7f00:1::1","fe80::1%eth0"):
            with self.subTest(ip=ip),self.assertRaises(ValidationError):
                validate_public_settings("cpanel-whm",{"server_url":origin,"username":"reseller","server_ip":ip})
            with self.assertRaises(SupplierEgressDenied):
                approved_origin(origin+"/json-api/listpkgs",bound_origin=(origin,ip))

    def test_bad_origins_and_cross_binding_refused(self):
        for url in ("http://panel.example.test:2087","https://panel.example.test:80",
                    "https://user:pass@panel.example.test:2087","https://panel.example.test:2087/path",
                    "https://panel.example.test:2087?x=y","https://8.8.8.8:2087","https://localhost:2087"):
            with self.subTest(url=url),self.assertRaises(ValidationError):
                validate_public_settings("cpanel-whm",{"server_url":url,"username":"reseller","server_ip":"8.8.8.8"})
        origin="https://panel.example.test:2087"
        for url in ("https://other.example.test:2087/json-api/listpkgs",
                    "https://panel.example.test:2222/json-api/listpkgs"):
            with self.assertRaises(SupplierEgressDenied):
                approved_origin(url,bound_origin=(origin,"8.8.8.8"))

    @override_settings(CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED=False)
    def test_global_gate_can_disable_configured_egress(self):
        origin="https://panel.example.test:2087"
        with self.assertRaises(ValidationError):
            validate_public_settings("cpanel-whm",{"server_url":origin,"username":"reseller","server_ip":"8.8.8.8"})
        with self.assertRaises(SupplierEgressDenied):
            approved_origin(origin+"/json-api/listpkgs",bound_origin=(origin,"8.8.8.8"))

    def test_transport_pins_address_checks_tls_and_rejects_redirects(self):
        origin="https://panel.example.test:2087"
        args={"params":{"api.version":"1","want":"creatable"},
            "headers":{"Accept":"application/json","Authorization":"whm reseller:fixture-token-only"},
            "timeout":4,"allow_redirects":False,"verify":True,
            "bound_origin":(origin,"8.8.8.8")}
        with patch("providers.pinned_egress.urllib3.HTTPSConnectionPool") as pool:
            reply=pool.return_value.request.return_value
            reply.status=200
            reply.headers={}
            reply.read.return_value=b"{}"
            result=pinned_get(origin+"/json-api/listpkgs",**args)
            self.assertEqual(result.status_code,200)
            self.assertEqual(pool.call_args.kwargs["host"],"8.8.8.8")
            self.assertEqual(pool.call_args.kwargs["server_hostname"],"panel.example.test")
            self.assertEqual(pool.call_args.kwargs["assert_hostname"],"panel.example.test")
            self.assertEqual(pool.call_args.kwargs["cert_reqs"],"CERT_REQUIRED")
            self.assertFalse(pool.return_value.request.call_args.kwargs["redirect"])
            self.assertFalse(pool.return_value.request.call_args.kwargs["retries"])
            reply.status=302
            with self.assertRaises(SupplierEgressDenied):
                pinned_get(origin+"/json-api/listpkgs",**args)
            before=pool.call_count
            with self.assertRaises(SupplierEgressDenied):
                pinned_get(origin+"/json-api/createacct",**args)
            self.assertEqual(pool.call_count,before)

    def test_inventory_gets_exact_binding_from_connection_not_browser_path(self):
        connection=SimpleNamespace(adapter_key="cpanel-whm",environment="test",
            public_settings={"server_url":"https://panel.example.test:2087","username":"reseller",
                             "server_ip":"8.8.8.8"})
        with patch("providers.hosting_inventory.fetch_inventory",return_value=[
                {"provider_package_id":"starter","name":"starter","specs":{"quota":"1024"}}]) as fetch:
            read_inventory(connection,{"api_token":"fixture-token-only"})
            self.assertEqual(fetch.call_args.kwargs["bound_origin"],
                             ("https://panel.example.test:2087","8.8.8.8"))
