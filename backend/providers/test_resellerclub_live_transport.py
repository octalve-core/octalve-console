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
