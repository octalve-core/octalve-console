"""Network denial and pinned TLS host binding tested without any supplier requests."""
from types import SimpleNamespace
from unittest.mock import patch,MagicMock
import json
from django.test import SimpleTestCase,override_settings
from providers.pinned_egress import pinned_get,approved_origin,SupplierEgressDenied
from providers.adapters.directadmin import DirectAdminAdapter

HOST="panel.verified-host.test"
URL="https://"+HOST+":2222/CMD_API_PACKAGES_USER"
IP="8.8.8.8"
PIN=json.dumps({HOST:IP})
@override_settings(CLOUD_SUPPLIER_PINNED_READBACK_ENABLED=True,CLOUD_SUPPLIER_PINNED_IPS_JSON=PIN)
class SupplierPinnedEgressTests(SimpleTestCase):
    def setUp(self):
        self.allow=patch.dict("os.environ",{"CLOUD_INVENTORY_ALLOWED_HOSTS":HOST})
        self.allow.start()
        self.addCleanup(self.allow.stop)

    def test_exact_host_port_ip_and_original_hostname_bound_to_tls(self):
        self.assertEqual(approved_origin(URL),(HOST,2222,IP,"/CMD_API_PACKAGES_USER"))
        raw=MagicMock()
        raw.status=200
        raw.headers={"content-length":"8"}
        raw.read.return_value=b'list[]=a'
        pool=MagicMock()
        pool.request.return_value=raw
        with patch("providers.pinned_egress.urllib3.HTTPSConnectionPool",return_value=pool) as factory:
            response=pinned_get(URL,params={},headers={"Authorization":"Basic c3ludGhldGlj","Accept":"application/json"},
                                timeout=4,allow_redirects=False,verify=True)
        self.assertEqual(response.text,"list[]=a")
        self.assertEqual(response.status_code,200)
        kwargs=factory.call_args.kwargs
        self.assertEqual(kwargs["host"],IP)
        self.assertEqual(kwargs["server_hostname"],HOST)
        self.assertEqual(kwargs["assert_hostname"],HOST)
        self.assertEqual(kwargs["cert_reqs"],"CERT_REQUIRED")
        args=pool.request.call_args
        self.assertEqual(args.args[:2],("GET","/CMD_API_PACKAGES_USER"))
        self.assertEqual(args.kwargs["headers"]["Host"],HOST+":2222")
        self.assertFalse(args.kwargs["redirect"])
        raw.release_conn.assert_called_once()
        pool.close.assert_called_once()

    def test_default_off_dangerous_hosts_urls_ports_and_pins_never_connect(self):
        unsafe=[
            URL.replace("https:","http:"),URL.replace(HOST,"localhost"),
            URL.replace(HOST,"169.254.169.254"),URL.replace(HOST,"metadata.google.internal"),
            URL.replace(":2222",":80"),URL+"?secret=value",
            "https://secret@"+HOST+":2222/path",
            "https://"+HOST+":2222/path#fragment",
            "https://"+HOST+":2222/path\nHost:bad",
        ]
        with patch("providers.pinned_egress.urllib3.HTTPSConnectionPool") as factory:
            for url in unsafe:
                with self.subTest(url=url),self.assertRaises(SupplierEgressDenied):
                    pinned_get(url,params={},headers={},timeout=4,allow_redirects=False,verify=True)
            with override_settings(CLOUD_SUPPLIER_PINNED_READBACK_ENABLED=False):
                with self.assertRaises(SupplierEgressDenied):
                    pinned_get(URL,params={},headers={},timeout=4,allow_redirects=False,verify=True)
            with override_settings(CLOUD_SUPPLIER_PINNED_IPS_JSON=json.dumps({HOST:"127.0.0.1"})):
                with self.assertRaises(SupplierEgressDenied):
                    pinned_get(URL,params={},headers={},timeout=4,allow_redirects=False,verify=True)
            factory.assert_not_called()

    def test_redirect_disabled_tls_verification_and_size_enforced(self):
        with self.assertRaises(SupplierEgressDenied):
            pinned_get(URL,params={},headers={},timeout=4,allow_redirects=True,verify=True)
        with self.assertRaises(SupplierEgressDenied):
            pinned_get(URL,params={},headers={},timeout=4,allow_redirects=False,verify=False)
        raw=MagicMock()
        raw.status=302
        raw.headers={}
        with patch("providers.pinned_egress.urllib3.HTTPSConnectionPool") as mockpool:
            mockpool.return_value.request.return_value=raw
            with self.assertRaises(SupplierEgressDenied):
                pinned_get(URL,params={},headers={"Authorization":"Basic c3ludGhldGlj","Accept":"application/json"},timeout=4,allow_redirects=False,verify=True)
        raw.status=200
        raw.headers={"content-length":"1000001"}
        with patch("providers.pinned_egress.urllib3.HTTPSConnectionPool") as mockpool:
            mockpool.return_value.request.return_value=raw
            with self.assertRaises(SupplierEgressDenied):
                pinned_get(URL,params={},headers={"Authorization":"Basic c3ludGhldGlj","Accept":"application/json"},timeout=4,allow_redirects=False,verify=True)
        raw.release_conn.assert_called()
        raw.close.assert_called()

    def test_legacy_directadmin_executor_cannot_post(self):
        provider=SimpleNamespace(base_url="https://"+HOST+":2222",timeout_seconds=4,test_mode=True,
                                 username="reseller",adapter_type="DirectAdminAdapter",get_api_key=lambda:"fake-key")
        adapter=DirectAdminAdapter(provider)
        with patch("providers.adapters.base.requests.request") as outbound:
            result=adapter._make_request("CMD_API_ACCOUNT_USER",method="POST",data={"action":"create"})
        self.assertFalse(result.success)
        outbound.assert_not_called()
