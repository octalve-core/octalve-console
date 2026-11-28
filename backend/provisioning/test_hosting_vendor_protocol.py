"""No-network negative qualification of both hosting provider protocols."""
import json
from dataclasses import replace
from unittest.mock import patch,Mock
from urllib.parse import urlencode
from django.test import SimpleTestCase,override_settings
from provisioning.account_creation_plan import AccountCreationPlan
from provisioning.hosting_vendor_protocol import (PinnedHostingProtocol,VendorProtocolRefused,
    verify_account_absent,verify_created_account,verify_create_response)
from providers.pinned_egress import SupplierReadResponse,SupplierEgressDenied


class HostingVendorProtocolTests(SimpleTestCase):
    def plan(self,adapter="CpanelAdapter"):
        return AccountCreationPlan(task_id=1,service_id=2,provider_id=3,adapter_type=adapter,
            username="oc000001",domain="verified.example.test",package="starter",
            reseller_owner="reseller",email="customer@example.test")

    def whm(self,command,rows=None,result=1,status=200):
        return SupplierReadResponse(status,json.dumps({"metadata":{"command":command,"result":result},
            "data":{"acct":rows if rows is not None else []}}).encode())

    def da(self,data,status=200):
        return SupplierReadResponse(status,urlencode(data).encode())

    def test_account_absence_requires_exact_success_and_empty_results(self):
        p=self.plan()
        self.assertTrue(verify_account_absent(p,self.whm("listaccts")))
        for response in (self.whm("listaccts",[{"user":p.username}]),self.whm("listaccts",result=0),
                         self.whm("listaccts",status=404),self.whm("accountsummary")):
            with self.assertRaises(VendorProtocolRefused):
                verify_account_absent(p,response)
        p=self.plan("DirectAdminAdapter")
        self.assertTrue(verify_account_absent(p,self.da({"error":0,"exists":0})))
        for response in (self.da({"error":1,"exists":0}),self.da({"error":0,"exists":1}),
                         SupplierReadResponse(200,b"error=0&exists=0&exists=1"),self.da({"exists":0})):
            with self.assertRaises(VendorProtocolRefused):
                verify_account_absent(p,response)

    def test_exact_identity_required_for_both_suppliers(self):
        p=self.plan()
        row={"user":p.username,"domain":p.domain,"owner":p.reseller_owner,"plan":p.package,
             "email":p.email,"suspended":0}
        self.assertTrue(verify_created_account(p,self.whm("accountsummary",[row])))
        for key,value in (("user","wrong"),("domain","other.example.test"),("owner","other"),
                          ("plan","free"),("email","other@example.test"),("suspended",1)):
            with self.subTest(key=key),self.assertRaises(VendorProtocolRefused):
                verify_created_account(p,self.whm("accountsummary",[{**row,key:value}]))
        for rows in ([],[row,row]):
            with self.assertRaises(VendorProtocolRefused):
                verify_created_account(p,self.whm("accountsummary",rows))
        p=self.plan("DirectAdminAdapter")
        row={"username":p.username,"domain":p.domain,"creator":p.reseller_owner,
             "package":p.package,"email":p.email,"usertype":"user","account":"ON","suspended":"no"}
        self.assertTrue(verify_created_account(p,self.da(row)))
        for key,value in (("creator","root"),("package","other"),("account","OFF"),("suspended","yes"),
                          ("usertype","admin"),("username","other"),("domain","other.example.test")):
            with self.subTest(key=key),self.assertRaises(VendorProtocolRefused):
                verify_created_account(p,self.da({**row,key:value}))

    @override_settings(CLOUD_HOSTING_VENDOR_CREATE_ENABLED=False)
    def test_disabled_create_never_touches_network_even_with_dispatch_flag(self):
        client=PinnedHostingProtocol(self.plan(),"https://panel.example.test:2087",
                                      "reseller","fixture-only-token-012345")
        with patch.object(client,"_request") as network:
            with self.assertRaises(VendorProtocolRefused):
                client.create(dispatch_authorized=True)
            network.assert_not_called()

    @override_settings(CLOUD_HOSTING_VENDOR_CREATE_ENABLED=True)
    def test_write_contract_exact_and_no_secret_in_whm_query(self):
        client=PinnedHostingProtocol(self.plan(),"https://panel.example.test:2087",
                                      "reseller","fixture-only-token-012345")
        with patch.object(client,"_request",return_value=self.whm("createacct")) as network:
            with self.assertRaises(VendorProtocolRefused):
                client.create()
            network.assert_not_called()
            self.assertTrue(client.create(dispatch_authorized=True))
            method,path,fields=network.call_args.args
            self.assertEqual((method,path),("GET","/json-api/createacct"))
            self.assertEqual(fields["username"],"oc000001")
            self.assertEqual(fields["plan"],"starter")
            self.assertEqual(fields["showpass"],"n")
            self.assertNotIn("password",fields)
        client=PinnedHostingProtocol(self.plan("DirectAdminAdapter"),"https://panel.example.test:2222",
                                      "reseller","fixture-only-token-012345")
        with patch.object(client,"_request",return_value=self.da({"error":0})) as network:
            for address in (None,"127.0.0.1","169.254.169.254","192.168.1.2"):
                with self.assertRaises(VendorProtocolRefused):
                    client.create(dispatch_authorized=True,shared_ip=address)
            network.assert_not_called()
            self.assertTrue(client.create(dispatch_authorized=True,shared_ip="8.8.8.8"))
            method,path,fields=network.call_args.args
            self.assertEqual((method,path),("POST","/CMD_API_ACCOUNT_USER"))
            self.assertEqual(fields["passwd"],fields["passwd2"])
            self.assertGreaterEqual(len(fields["passwd"]),32)
            self.assertEqual(fields["notify"],"no")

    def test_wrong_origin_or_root_credential_never_networks(self):
        with self.assertRaises(VendorProtocolRefused):
            PinnedHostingProtocol(self.plan(),"https://panel.example.test:2087",
                                  "root","fixture-only-token-012345")
        client=PinnedHostingProtocol(self.plan(),"https://panel.example.test:2087",
                                      "reseller","fixture-only-token-012345")
        with patch("provisioning.hosting_vendor_protocol.approved_origin",side_effect=SupplierEgressDenied),patch(
                "provisioning.hosting_vendor_protocol.urllib3.HTTPSConnectionPool") as pool:
            with self.assertRaises(SupplierEgressDenied):
                client.absent()
            pool.assert_not_called()
