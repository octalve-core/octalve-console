from unittest.mock import Mock
from django.test import SimpleTestCase
from .resellerclub_sandbox import verify_credentials,verify_sandbox,ResellerClubUnavailable

class ResellerClubLiveCredentialsTests(SimpleTestCase):
    def test_environment_specific_fixed_endpoint_and_no_execution(self):
        for environment,origin in (("test","https://api.sandbox.resellerclub.com/v2"),("live","https://api.resellerclub.com/v2")):
            session=Mock()
            response=session.get.return_value.__enter__=Mock()
            reply=Mock(status_code=200)
            reply.iter_content.return_value=[b'{"totalItems":0,"itemsOnPage":0,"actions":[]}']
            session.get.return_value.__enter__.return_value=reply
            session.get.return_value.__exit__=Mock(return_value=False)
            result=verify_credentials("123","fixture-secret-key",environment,session_factory=lambda:session)
            self.assertEqual(result["environment"],environment)
            self.assertFalse(result["registration_enabled"])
            self.assertEqual(session.get.call_args.args[0],origin+"/actions/search-current")
            self.assertFalse(session.get.call_args.kwargs["allow_redirects"])
            session.close.assert_called_once()
    def test_legacy_sandbox_wrapper_cannot_use_live(self):
        with self.assertRaises(ResellerClubUnavailable):
            verify_sandbox("123","fixture-secret-key","live")
