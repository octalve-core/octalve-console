"""B3 read-only vendor contract certification with synthetic fixtures only.

Never contacts real DirectAdmin/WHM, never mutates provider/service or bills.
Production connection certification still requires independently approved host,
firewall, least-privilege tokens, and supplier-specific witnessed acceptance.
"""
import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from providers.inventory import fetch_inventory, InventoryError
from providers.pinned_egress import SupplierReadResponse
from opanel_bridge.readback import _da_account, _whm_account, ReadbackRejected

DA_HOST="da.certification.example.invalid"
WHM_HOST="whm.certification.example.invalid"


def provider(adapter):
    host,port=(DA_HOST,2222) if adapter=="DirectAdminAdapter" else (WHM_HOST,2087)
    return SimpleNamespace(adapter_type=adapter,base_url=f"https://{host}:{port}",
        username="certreseller",timeout_seconds=3,get_api_key=lambda:"CI-NONFUNCTIONAL-TOKEN-123456")


class VendorCertificationFixtures(SimpleTestCase):
    def setUp(self):
        self.allowed=patch.dict("os.environ",{"CLOUD_INVENTORY_ALLOWED_HOSTS":DA_HOST+","+WHM_HOST})
        self.allowed.start()
        self.addCleanup(self.allowed.stop)

    def test_directadmin_exact_two_readonly_requests(self):
        sent=[]
        def read(url,**kwargs):
            sent.append((url,kwargs))
            if len(sent)==1:
                return SupplierReadResponse(200,b"list%5B%5D=starter")
            if len(sent)==2:
                return SupplierReadResponse(200,b"quota=2000&bandwidth=10000&vdomains=5&ssl=ON")
            raise AssertionError("Unexpected vendor request")
        offers=fetch_inventory(provider("DirectAdminAdapter"),getter=read)
        self.assertEqual(len(offers),1)
        self.assertEqual(offers[0]["provider_package_id"],"starter")
        self.assertEqual(offers[0]["specs"]["quota"],"2000")
        self.assertEqual([x[0].split(":2222")[1] for x in sent],
                         ["/CMD_API_PACKAGES_USER","/CMD_API_PACKAGES_USER"])
        self.assertEqual([x[1]["params"] for x in sent],[{},{"package":"starter"}])
        self.assertTrue(all(x[1]["allow_redirects"] is False and x[1]["verify"] is True for x in sent))
        self.assertTrue(all("Authorization" in x[1]["headers"] for x in sent))
        self.assertTrue(all(x[1]["headers"]["Authorization"].startswith("Basic ") for x in sent))

    def test_whm_package_list_uses_only_versioned_listpkgs(self):
        sent=[]
        def read(url,**kwargs):
            sent.append((url,kwargs))
            response={"metadata":{"result":1},"data":{"pkg":[
                {"name":"Basic","QUOTA":2048,"BWLIMIT":10000},
                {"name":"Business","QUOTA":5120,"BWLIMIT":30000},
            ]}}
            return SupplierReadResponse(200,json.dumps(response).encode())
        offers=fetch_inventory(provider("CpanelAdapter"),getter=read)
        self.assertEqual([item["name"] for item in offers],["Basic","Business"])
        self.assertEqual(offers[0]["specs"]["quota"],"2048")
        self.assertEqual(len(sent),1)
        self.assertTrue(sent[0][0].endswith("/json-api/listpkgs"))
        self.assertEqual(sent[0][1]["params"],{"api.version":"1","want":"creatable"})
        self.assertTrue(sent[0][1]["headers"]["Authorization"].startswith("whm certreseller:"))
        self.assertFalse(sent[0][1]["allow_redirects"])

    def test_vendor_errors_ambiguous_accounts_and_identity_mismatch_rejected(self):
        with self.assertRaises(InventoryError):
            fetch_inventory(provider("DirectAdminAdapter"),
                            getter=lambda *_a,**_k:SupplierReadResponse(200,b"error=1&text=denied"))
        bad={"metadata":{"result":1},"data":{"pkg":[{"name":"same"},{"name":"same"}]}}
        with self.assertRaises(InventoryError):
            fetch_inventory(provider("CpanelAdapter"),
                            getter=lambda *_a,**_k:SupplierReadResponse(200,json.dumps(bad).encode()))
        with self.assertRaises(InventoryError):
            fetch_inventory(provider("CpanelAdapter"),
                            getter=lambda *_a,**_k:SupplierReadResponse(403,b"{}"))
        with self.assertRaises(ReadbackRejected):
            _da_account("username=octalvetest&creator=another&domain=example.invalid&usertype=user&account=ON&suspended=no",
                        "octalvetest","example.invalid","certreseller")
        with self.assertRaises(ReadbackRejected):
            _whm_account({"metadata":{"result":1},"data":{"acct":[
                {"user":"octalvetest","domain":"example.invalid","owner":"unknown","suspended":0}]}},
                        "octalvetest","example.invalid","certreseller")

    def test_valid_existing_account_identity_but_never_autoactivates_service(self):
        self.assertTrue(_da_account(
            "username=octalvetest&creator=certreseller&domain=example.invalid&usertype=user&account=ON&suspended=no",
            "octalvetest","example.invalid","certreseller"))
        self.assertTrue(_whm_account(
            {"metadata":{"result":1},"data":{"acct":[
              {"user":"octalvetest","domain":"example.invalid","owner":"certreseller","suspended":0}]}},
            "octalvetest","example.invalid","certreseller"))
        # These parsing routines do not create VerifiedHostingBinding or any
        # service entitlement. Separate Console ownership and active service
        # checks remain the only authority for OPanel SSO.
