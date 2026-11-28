from unittest.mock import patch
from django.test import SimpleTestCase
from .resellerclub_live import ResellerClub,ResellerClubUnavailable,nameservers

class ResellerClubTransportTests(SimpleTestCase):
    def setUp(self):
        self.rc=ResellerClub("123","fixture-not-real-key","live")

    def test_standard_quote_rejects_premium_and_wrong_domain(self):
        quote={"domains":[{"domainName":"alpha.com","status":"available","cost":[{"action":"registration","price":"10.00","currency":"USD"},{"action":"renewal","price":"12.00","currency":"USD"},{"action":"transfer","price":"11.00","currency":"USD"}]}]}
        with patch.object(self.rc,"_call",side_effect=[quote,{"premium":False}]):
            self.assertEqual(self.rc.live_domain_check("alpha.com")["transfer_cost"],"11.00")
        with patch.object(self.rc,"_call",side_effect=[quote,{"premium":True}]):
            with self.assertRaises(ResellerClubUnavailable):self.rc.live_domain_check("alpha.com")
        with patch.object(self.rc,"_call",return_value=quote):
            with self.assertRaises(ResellerClubUnavailable):self.rc.live_domain_check("beta.com")

    def test_readback_exact_resource_and_epp_only_on_request(self):
        data={"domain":{"domainName":"alpha.com","resellerId":123,"isImmediateReseller":True,"orderId":5,"customerId":6,"registrantContactId":7,"creationTime":1795800000,"domainEndTime":1827336000,"currentStatus":"Active","isAutoRenew":False,"isPremium":False,"registrantEmail":"fixture@example.test","domainSecret":"fixture-epp-123","raaVerificationStatus":"Verified","numberOfNameServers":2,"ns1":"ns1.example.com","ns2":"ns2.example.com"}}
        with patch.object(self.rc,"_call",return_value=data):
            result=self.rc.domain_details("alpha.com",order="5",customer="6",contact="7")
            self.assertNotIn("auth_code",result)
            self.assertEqual(result["registrant_verification"],"Verified")
            self.assertEqual(self.rc.domain_details("alpha.com",order="5",include_secret=True)["auth_code"],"fixture-epp-123")
            with self.assertRaises(ResellerClubUnavailable):self.rc.domain_details("alpha.com",customer="99")
        with self.assertRaises(ResellerClubUnavailable):nameservers(["ns1.example.com","ns1.example.com"])

    def test_expanded_standard_domain_and_otp_contract(self):
        from .registrar_names import require_standard_domain
        from .cloudflare_int01 import CloudflareINT01Denied
        self.assertEqual(require_standard_domain("example.org","resellerclub"),"example.org")
        for name,adapter in (("example.org","cloudflare-registrar-live"),("example.ng","resellerclub"),("xn--example.com","resellerclub")):
            with self.assertRaises(CloudflareINT01Denied):require_standard_domain(name,adapter)
        with patch.object(self.rc,"_call",return_value={"entityId":"5","eaqId":"6"}) as vendor:
            self.assertEqual(self.rc.change_transfer_lock("5",True,"123456"),"6")
            self.assertEqual(vendor.call_args.kwargs["body"],{"enabled":True,"otp":"123456","twoFactorType":"EMAIL"})
            self.rc.change_nameservers("5",["ns1.example.com","ns2.example.com"],"123456")
            self.assertEqual(vendor.call_args.kwargs["body"]["twoFactorType"],"email")
            self.rc.change_auth_code("5","Fixture!123","123456")
            self.assertEqual(vendor.call_args.kwargs["body"]["authCode"],"Fixture!123")
        with patch.object(self.rc,"_call",return_value={"success":True}) as vendor:
            self.assertTrue(self.rc.email_otp("5","modify-ns"))
            vendor.assert_called_once_with("POST","/domains/5/domain-protection/modify-ns/email-otp")
            with self.assertRaises(ResellerClubUnavailable):self.rc.email_otp("5","unknown")
