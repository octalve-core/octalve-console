"""INT-01 deterministic tests: all provider responses synthetic, never internet."""
import io
import json
from unittest.mock import patch,MagicMock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase

from providers.cloudflare_int01 import (
    CloudflareINT01, CloudflareINT01Denied, FixedCloudflareTransport,
    require_domain, require_id
)

ACCOUNT="a"*32
ZONE="b"*32
DOMAIN="int01test-abc123.com"

def envelope(result):
    return {"success":True,"errors":[],"result":result}

class FixtureTransport:
    def __init__(self):
        self.calls=[]
        self.status="available"
        self.owner=ACCOUNT
    def __call__(self,method,path,body=None):
        self.calls.append((method,path,body))
        if path=="/zones":
            return envelope([{"id":ZONE,"status":"active","account":{"id":self.owner}}])
        if path==f"/zones/{ZONE}/dns_records":
            return envelope([{"id":"dns-1","name":"int01test-abc123.com","type":"A","content":"192.0.2.13"}])
        if path.endswith("/registrations") and method=="GET":
            return envelope([])
        if path.endswith("/domain-check"):
            if self.status=="unavailable":
                return envelope({"domains":[{"name":DOMAIN,"registrable":False,"reason":"domain_unavailable"}]})
            return envelope({"domains":[{"name":DOMAIN,"registrable":True,"tier":"standard",
                 "pricing":{"currency":"USD","registration_cost":"8.57","renewal_cost":"9.09"}}]})
        if path.endswith("/extensions/com"):
            return envelope({"registration_schema":{"type":"object"}})
        if path.endswith("/registrations") and method=="POST":
            return envelope({"state":"succeeded","completed":True,"context":{"domain_name":DOMAIN}})
        if path.endswith("/registrations/"+DOMAIN):
            return envelope({"domain_name":DOMAIN,"status":"active","expires_at":"2027-11-01T00:00:00Z"})
        raise AssertionError("Unexpected operation: "+method+path)

class CloudflareINT01ContractTests(SimpleTestCase):
    def test_dns_readback_binds_account_and_does_not_change_records(self):
        t=FixtureTransport()
        result=CloudflareINT01(ACCOUNT,t).dns_readback(ZONE)
        self.assertTrue(result["zone_verified"])
        self.assertEqual(result["dns_record_count"],1)
        self.assertEqual(len(result["record_digest_sha256"]),64)
        self.assertFalse(result["side_effects"])
        self.assertEqual([row[0] for row in t.calls],["GET","GET"])
        t.owner="c"*32
        with self.assertRaises(CloudflareINT01Denied):
            CloudflareINT01(ACCOUNT,t).dns_readback(ZONE)

    def test_sandbox_read_check_and_pricing(self):
        t=FixtureTransport()
        c=CloudflareINT01(ACCOUNT,t)
        self.assertTrue(c.sandbox_readback()["sandbox_authenticated"])
        value=c.check(DOMAIN)
        self.assertEqual(value["registration_cost"],"8.57")
        self.assertEqual(value["renewal_cost"],"9.09")
        self.assertEqual(value["currency"],"USD")
        self.assertEqual(t.calls[-1][2],{"domains":[DOMAIN]})
        t.status="unavailable"
        self.assertFalse(c.check(DOMAIN)["registrable"])

    def test_sandbox_create_requires_explicit_isolated_operator_approval(self):
        t=FixtureTransport()
        c=CloudflareINT01(ACCOUNT,t)
        with self.assertRaises(CloudflareINT01Denied):
            c.simulate_registration(DOMAIN,operator_approved=True)
        self.assertEqual(t.calls,[])
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED":"true","VERCEL":"1"}):
            with self.assertRaises(CloudflareINT01Denied):
                c.simulate_registration(DOMAIN,operator_approved=True)
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED":"true","VERCEL":"0"}):
            result=c.simulate_registration(DOMAIN,operator_approved=True)
        self.assertTrue(result["completed"])
        self.assertTrue(result["sandbox_only"])
        self.assertFalse(result["public_dns_created"])
        self.assertEqual(result["confirmation"]["sandbox_status"],"active")
        self.assertEqual([call[0] for call in t.calls],["POST","GET","POST","GET"])
        self.assertEqual(t.calls[-2][2],{
            "domain_name":DOMAIN,"years":1,"auto_renew":False,"privacy_mode":"redaction"})

    def test_unavailable_and_premium_never_write(self):
        t=FixtureTransport()
        t.status="unavailable"
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED":"true","VERCEL":"0"}):
            with self.assertRaises(CloudflareINT01Denied):
                CloudflareINT01(ACCOUNT,t).simulate_registration(DOMAIN,operator_approved=True)
        self.assertEqual([x[0] for x in t.calls],["POST"])

    def test_rejects_invalid_identifiers_and_domain_scope(self):
        for bad in ("../v1","127.0.0.1","A"*32,"", "foo.org","x"*500,"EXAMPLE.com"):
            with self.subTest(bad=bad):
                with self.assertRaises(CloudflareINT01Denied):
                    require_domain(bad)
        for bad in ("abc","../admin","127.0.0.1","b"*34):
            with self.subTest(bad=bad):
                with self.assertRaises(CloudflareINT01Denied):
                    require_id(bad)

    def test_transport_rejects_arbitrary_url_method_and_body_before_network(self):
        sess=MagicMock()
        conn=FixedCloudflareTransport("TEST_ONLY_NONFUNCTIONAL_TOKEN_123456",session=sess)
        for method,path,body in [
            ("POST","/zones",{"action":"delete"}),
            ("GET","http://localhost:8080",None),
            ("POST",f"/accounts/{ACCOUNT}/registrar/registrations",
             {"domain_name":DOMAIN}),
            ("GET","/accounts/"+ACCOUNT+"/registrar-sandbox/domain-check",None),
            ("POST",f"/accounts/{ACCOUNT}/registrar-sandbox/registrations",
             {"domain_name":DOMAIN,"action":"delete"}),
            ("DELETE",f"/zones/{ZONE}/dns_records",None),
        ]:
            with self.subTest(path=path),self.assertRaises(CloudflareINT01Denied):
                conn(method,path,body)
        sess.request.assert_not_called()

    def test_transport_bounded_response_and_no_error_body_leak(self):
        sess=MagicMock()
        response=MagicMock()
        response.status_code=200
        response.headers={}
        response.__enter__.return_value=response
        response.iter_content.return_value=[b"a"*140000]
        sess.request.return_value=response
        conn=FixedCloudflareTransport("TEST_ONLY_NONFUNCTIONAL_TOKEN_123456",session=sess)
        with self.assertRaises(CloudflareINT01Denied):
            conn("GET","/zones")
        response.iter_content.return_value=[b'{"success":false,"errors":[{"code":9999,"message":"secret"}]}']
        with self.assertRaises(CloudflareINT01Denied) as exc:
            CloudflareINT01(ACCOUNT,lambda m,p,b=None:conn(m,p,b)).sandbox_readback()
        self.assertNotIn("secret",str(exc.exception))
        sess.request.assert_called()
        for call in sess.request.call_args_list:
            kwargs=call.kwargs
            self.assertFalse(kwargs["allow_redirects"])
            self.assertTrue(kwargs["verify"])
            self.assertEqual(kwargs["timeout"],(3,8))
        self.assertFalse(sess.trust_env)

    def test_command_refuses_unapproved_sandbox_write_before_network(self):
        with self.assertRaises(CommandError):
            call_command("int01_cloudflare_probe",scope="sandbox",domain=DOMAIN,
                         simulate_registration=True,stdout=io.StringIO())
        with self.assertRaises(CommandError):
            call_command("int01_cloudflare_probe",scope="dns",zone_id=None,
                         stdout=io.StringIO())

    def test_sandbox_202_does_not_report_registered_or_retry(self):
        class Async(FixtureTransport):
            def __call__(self,m,p,b=None):
                if m=="POST" and p.endswith("/registrations"):
                    self.calls.append((m,p,b))
                    return envelope({"state":"in_progress","completed":False})
                return super().__call__(m,p,b)
        t=Async()
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_SANDBOX_WRITES_ENABLED":"true","VERCEL":"0"}):
            outcome=CloudflareINT01(ACCOUNT,t).simulate_registration(DOMAIN,operator_approved=True)
        self.assertEqual(outcome["state"],"in_progress")
        self.assertFalse(outcome["completed"])
        self.assertEqual(len(t.calls),3)
