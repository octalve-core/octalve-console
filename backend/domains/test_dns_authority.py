from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase,TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Domain
from .dns_authority import _parse, observe, DelegationUnavailable

NAME="example.test"
NS=["ns1.example.net","ns2.example.net"]

class ResolverContractTests(SimpleTestCase):
    def test_exact_question_and_nameservers(self):
        packet={"Status":0,"TC":False,"CD":False,"Question":[{"name":NAME+".","type":2}],
                "Answer":[{"name":NAME+".","type":2,"data":x+"."} for x in NS]}
        self.assertEqual(_parse(packet,NAME),NS)
        for wrong in ({"Status":3},{"TC":True},{"Question":[{"name":"foreign.test.","type":2}]},
                      {"Answer":[{"name":NAME+".","type":5,"data":"foreign.test."}]},
                      {"Answer":[{"name":"foreign.test.","type":2,"data":NS[0]}]}):
            with self.assertRaises(DelegationUnavailable):
                _parse({**packet,**wrong},NAME)

    def test_resolver_disagreement_is_not_authority(self):
        with patch("domains.dns_authority._query",side_effect=[NS,["ns3.example.net"]]):
            self.assertEqual(observe(NAME),{"state":"inconsistent","nameservers":[]})

class OwnerAuthorityTests(TestCase):
    def test_owned_domain_only_and_no_write_claim(self):
        users=get_user_model()
        owner=users.objects.create_user(email="authority-owner@example.test",username="authority-owner",role="client",password="SyntheticPassword123!")
        other=users.objects.create_user(email="authority-other@example.test",username="authority-other",role="client",password="SyntheticPassword123!")
        due=timezone.now()+timedelta(days=30)
        domain=Domain.objects.create(client=owner,domain_name=NAME,tld=".test",status="active",expiry_date=due,next_due_date=due)
        path=f"/api/domains/domains/{domain.pk}/dns-authority/"
        api=APIClient()
        with patch("domains.dns_authority.observe",return_value={"state":"observed","nameservers":NS}) as query:
            api.force_authenticate(other)
            self.assertEqual(api.get(path).status_code,404)
            query.assert_not_called()
            api.force_authenticate(owner)
            result=api.get(path)
            self.assertEqual(result.status_code,200,result.data)
            self.assertEqual(result.data["configured_zone_comparison"],"not_connected")
            self.assertFalse(result.data["write_authorized"])
            self.assertFalse(result.data["public_propagation_verified"])
            query.assert_called_once_with(NAME)
