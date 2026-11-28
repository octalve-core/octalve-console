"""Synthetic usage and transport tests: no real supplier traffic."""
import json
from unittest.mock import patch
from urllib.parse import urlencode
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from providers.pinned_egress import SupplierReadResponse, validate_readback_contract, SupplierEgressDenied
from services.usage_sync import _directadmin, _whm, _mb, UsageRefused, synchronize


def form(**data):
    return SupplierReadResponse(200, urlencode(data).encode())


def whm(entries, **kwargs):
    return SupplierReadResponse(200, json.dumps({
        "metadata":{"command":"uapi_cpanel","result":1},
        "data":{"uapi":{"module":"StatsBar","func":"get_stats",
                       "result":{"status":1,"data":entries,**kwargs}}}
    }).encode())


class UsageProtocolTests(SimpleTestCase):
    def test_directadmin_usage_never_invents_missing_values(self):
        result = _directadmin({"quota":"1000","bandwidth":"unlimited"},
                              form(quota="10.5",bandwidth="0.2"))
        self.assertEqual(result["disk_used_mb"],11)
        self.assertEqual(result["disk_limit_mb"],1000)
        self.assertEqual(result["bandwidth_used_mb"],1)
        self.assertTrue(result["raw_data"]["bandwidth_unlimited"])
        with self.assertRaises(UsageRefused):
            _directadmin({"quota":"1000","bandwidth":"2000"},form(quota="1"))
        with self.assertRaises(UsageRefused):
            _directadmin({"quota":"1000","bandwidth":"2000"},SupplierReadResponse(200,b"quota=1&quota=2&bandwidth=3"))

    def test_optional_resource_counts_distinguish_unknown_zero_and_unlimited(self):
        result=_directadmin({"quota":"1000","bandwidth":"1000","nemails":"unlimited","mysql":"0"},
                            form(quota="10",bandwidth="1",nemails="2",mysql="0",nsubdomains="0"))
        counts=result["raw_data"]["resource_counts"]
        self.assertEqual(counts["email"],{"used":2,"limit":None,"unlimited":True})
        self.assertEqual(counts["database"],{"used":0,"limit":0,"unlimited":False})
        self.assertNotIn("subdomains",counts)
        result=_whm(whm([{"id":"diskusage","count":"1 MB","max":"2 MB"},
                         {"id":"bandwidthusage","count":"1 MB","max":"unlimited"},
                         {"id":"emailaccounts","_count":"3","_max":"5"},
                         {"id":"sqldatabases","_count":"0","_max":"unlimited"},
                         {"id":"subdomains","_count":"1","_max":"unknown"}]))
        self.assertEqual(result["email_used"],3)
        self.assertEqual(result["database_used"],0)
        self.assertTrue(result["raw_data"]["resource_counts"]["database"]["unlimited"])
        self.assertNotIn("subdomains",result["raw_data"]["resource_counts"])

    def test_whm_usage_requires_both_result_envelopes_and_units(self):
        rows=[{"id":"diskusage","count":"1.5 GB","max":"2 GB"},
              {"id":"bandwidthusage","count":"7 MB","max":"unlimited"}]
        result=_whm(whm(rows))
        self.assertEqual(result["disk_used_mb"],1536)
        self.assertEqual(result["disk_limit_mb"],2048)
        self.assertEqual(result["bandwidth_used_mb"],7)
        self.assertTrue(result["raw_data"]["bandwidth_unlimited"])
        for invalid in (whm(rows,status=0), whm(rows,errors=["denied"]),whm([rows[0],rows[0]])):
            with self.assertRaises(UsageRefused):
                _whm(invalid)
        for bad in ("NaN","1 PB","-2 MB","0x10",True):
            with self.assertRaises(UsageRefused):
                _mb(bad,explicit_units=True)

    def test_usage_readback_is_not_a_generic_uapi_proxy(self):
        headers={"Accept":"application/json","Authorization":"whm reseller:synthetic-token"}
        params={"api.version":"1","cpanel.user":"checkhost","cpanel.module":"StatsBar",
                "cpanel.function":"get_stats","display":"bandwidthusage|diskusage"}
        validate_readback_contract("/json-api/uapi_cpanel",2087,params,headers)
        for bad in ({**params,"cpanel.function":"delete_file"},
                    {**params,"cpanel.module":"Email"},
                    {**params,"cpanel.user":"../root"},
                    {**params,"extra":"x"}):
            with self.assertRaises(SupplierEgressDenied):
                validate_readback_contract("/json-api/uapi_cpanel",2087,bad,headers)
        validate_readback_contract("/CMD_API_SHOW_USER_USAGE",2222,{"user":"checkhost"},
                                   {"Accept":"application/json","Authorization":"Basic YTpi"})

    @override_settings(OPANEL_READBACK_ENABLED=False)
    def test_disabled_usage_never_calls_supplier(self):
        with patch("services.usage_sync.pinned_get") as request:
            self.assertFalse(synchronize(1))
            request.assert_not_called()


class UsageWorkerTests(TestCase):
    def test_cron_auth_and_fixed_scope(self):
        api=APIClient()
        path="/api/provisioning/hosting-usage/cron/"
        with patch.dict("os.environ",{"CRON_SECRET":"synthetic-secret-for-usage-worker-regression"}), patch(
            "services.usage_sync.run_due_usage",return_value={"enabled":True,"recorded":0,"held":0}) as run:
            self.assertEqual(api.get(path).status_code,401)
            self.assertEqual(api.post(path,{},format="json").status_code,405)
            response=api.get(path+"?service_id=999",HTTP_AUTHORIZATION="Bearer synthetic-secret-for-usage-worker-regression")
            self.assertEqual(response.status_code,200)
            run.assert_called_once_with(2)
