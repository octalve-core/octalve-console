from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from .dns_write import normalize,record_name,observed,digest,Refused,gate
from providers.connection_vault import VaultUnavailable

class DNSWriteContractTests(SimpleTestCase):
    def record(self,**kwargs):
        return {"name":"www.example.test","type":"A","value":"8.8.8.8","ttl":300,"priority":None,**kwargs}

    def test_types_and_protected_names(self):
        self.assertEqual(normalize(self.record(),"example.test")["value"],"8.8.8.8")
        self.assertEqual(normalize(self.record(type="MX",value="mx.example.net",priority=10),"example.test")["priority"],10)
        for bad in (self.record(name="other.test"),self.record(name="_acme-challenge.example.test"),
                    self.record(name="_octalve-claim.example.test"),self.record(value="127.0.0.1"),
                    self.record(type="NS"),self.record(type="CNAME",name="@",
                    value="host.example.net"),self.record(ttl=0)):
            with self.assertRaises((Refused,ValueError)):
                normalize(bad,"example.test")

    def test_exact_independent_readback_not_ack(self):
        row={**self.record(),"id":"a"*32,"proxied":False}
        fence={"operation":"create","desired":digest(self.record()),"target":None,"before_ids":[]}
        self.assertTrue(observed([row],fence,"example.test"))
        self.assertFalse(observed([],fence,"example.test"))
        self.assertFalse(observed([row],{**fence,"before_ids":[row["id"]]},"example.test"))
        self.assertFalse(observed([{**row,"proxied":True}],fence,"example.test"))
        self.assertTrue(observed([],{"operation":"delete","target":row["id"]},"example.test"))

    @override_settings(CLOUD_DNS01_READONLY_ENABLED=True,CLOUD_DNS_WRITE_ENABLED=False)
    def test_default_gate(self):
        with self.assertRaises(Refused):
            gate()
