"""No-network contract, tenant and durable resource reservation regressions."""
import json
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from opanel_bridge.models import VerifiedHostingBinding
from opanel_bridge.policy import account_digest
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from providers.hosting_runtime import validate_resource_capabilities
from providers.models import Provider
from providers.pinned_egress import SupplierReadResponse
from services.models import Service
from services.resource_protocol import ResourceProtocol, ResourceRefused, mailbox_name
from services import resource_management as management


def reply(data):
    return SupplierReadResponse(200,json.dumps(data).encode())


def whm(module,function,data,status=1):
    return reply({"metadata":{"command":"uapi_cpanel","result":1},
                  "data":{"uapi":{"module":module,"func":function,
                                  "result":{"status":status,"data":data,"errors":None}}}})


class ProtocolTests(SimpleTestCase):
    def adapter(self,name):
        port=2222 if name=="directadmin" else 2087
        service=SimpleNamespace(domain_name="example.test",provider_identifier="checkhost")
        provider=SimpleNamespace(username="resellerops")
        row=SimpleNamespace(adapter_key=name,public_settings={"server_url":f"https://supplier.example.test:{port}",
                                                               "server_ip":"8.8.8.8"})
        return ResourceProtocol(service,provider,row,"synthetic-token")

    def test_directadmin_mailbox_inventory_and_creation_fixed_target(self):
        protocol=self.adapter("directadmin")
        with patch.object(protocol,"_request",side_effect=[
            reply({"info":{"quota":"500","secret":"must-not-return"}}),
            SupplierReadResponse(200,b"error=0&text=accepted")]) as send:
            self.assertEqual(protocol.mailboxes(),[{"address":"info@example.test","quota_mb":500,"unlimited":False}])
            protocol.create_mailbox("sales","Only-Synthetic-Password",600)
        self.assertEqual(send.call_args_list[0].args,("GET","/CMD_API_POP",{"action":"full_list","domain":"example.test","json":"yes"}))
        method,path,fields=send.call_args_list[1].args
        self.assertEqual((method,path),("POST","/CMD_API_POP"))
        self.assertEqual(fields["domain"],"example.test")
        self.assertEqual(fields["user"],"sales")
        self.assertEqual(fields["passwd"],fields["passwd2"])

    def test_whm_exact_account_scoped_uapi_and_no_password_in_read(self):
        protocol=self.adapter("cpanel-whm")
        with patch.object(protocol,"_request",side_effect=[
            whm("Email","list_pops_with_disk",[{"email":"info@example.test","txtdiskquota":"500"}]),
            whm("Email","add_pop","sales+example.test")]) as send:
            self.assertEqual(protocol.mailboxes()[0]["address"],"info@example.test")
            protocol.create_mailbox("sales","Only-Synthetic-Password",600)
        a=send.call_args_list[0].args
        self.assertEqual(a[0:2],("GET","/json-api/uapi_cpanel"))
        self.assertEqual(a[2]["cpanel.user"],"checkhost")
        self.assertNotIn("password",a[2])
        a=send.call_args_list[1].args
        self.assertEqual(a[0],"POST")
        self.assertEqual(a[2]["cpanel.function"],"add_pop")
        self.assertEqual(a[2]["domain"],"example.test")

    def test_cross_domain_and_failed_envelopes_are_not_empty_success(self):
        protocol=self.adapter("cpanel-whm")
        for response in (whm("Email","list_pops_with_disk",[{"email":"info@other.test","txtdiskquota":"500"}]),
                         whm("Email","list_pops_with_disk",[],status=0),
                         whm("Email","unexpected",[]),
                         SupplierReadResponse(200,b""),
                         whm("Email","list_pops_with_disk",[{"email":"info@example.test","txtdiskquota":"garbage"}])):
            with patch.object(protocol,"_request",return_value=response),self.assertRaises(ResourceRefused):
                protocol.mailboxes()

    def test_subdomain_list_requires_verified_domain_and_no_unrelated_names(self):
        protocol=self.adapter("directadmin")
        with patch.object(protocol,"_request",return_value=SupplierReadResponse(200,b"list%5B%5D=shop&list%5B%5D=blog")):
            self.assertEqual(protocol.subdomains(),["blog.example.test","shop.example.test"])
        protocol=self.adapter("cpanel-whm")
        with patch.object(protocol,"_request",return_value=whm("DomainInfo","list_domains",
                 {"main_domain":"example.test","sub_domains":["blog.example.test","other.other.test"]})):
            self.assertEqual(protocol.subdomains(),["blog.example.test"])
        with patch.object(protocol,"_request",return_value=whm("DomainInfo","list_domains",
                 {"main_domain":"other.test","sub_domains":[]})),self.assertRaises(ResourceRefused):
            protocol.subdomains()

    def test_invalid_names_and_capability_dependency(self):
        for name in ("root","postmaster","../x","x@other.test","x..y","a."):
            with self.assertRaises(ResourceRefused):
                mailbox_name(name)
        self.assertEqual(validate_resource_capabilities(["mailbox_read","mailbox_create"]),["mailbox_create","mailbox_read"])
        for values in (["mailbox_create"],["arbitrary_proxy"],["mailbox_read","mailbox_read"],[{}]):
            with self.assertRaises(VaultUnavailable):
                validate_resource_capabilities(values)


@override_settings(CLOUD_HOSTING_NATIVE_RESOURCES_ENABLED=True)
class ResourceAuthorityTests(TestCase):
    def setUp(self):
        user=get_user_model()
        self.owner=user.objects.create_user(email="native-resource-owner@example.test",username="resourceowner",
            password="SyntheticConsolePassword",role="client")
        self.other=user.objects.create_user(email="native-resource-other@example.test",username="resourceother",
            password="SyntheticConsolePassword",role="client")
        self.row=IntegrationConnection.objects.create(adapter_key="cpanel-whm",label="Synthetic supplier",
            environment="live",public_settings={"server_url":"https://supplier.example.test:2087",
                "server_ip":"8.8.8.8","username":"resellerops"})
        self.provider=Provider.objects.create(name="Synthetic",adapter_type="CpanelAdapter",
            base_url="https://supplier.example.test:2087",username="resellerops",status="active",
            health_status="healthy",test_mode=False,config={"hosting_account_owner":"resellerops",
                "hosting_vault_connection_id":str(self.row.pk),"hosting_execution_policy_v1":{"mac":"fixture-only"}})
        self.service=Service.objects.create(client=self.owner,product_id=1,plan_id=1,
            provider_id=self.provider.pk,status="active",label="Hosting",service_type="hosting",
            domain_name="example.test",provider_identifier="checkhost",provider_package_id="basic",
            billing_cycle="1mo",amount=Decimal("3000"),currency="NGN",
            activated_at=timezone.now()-timedelta(minutes=3),next_due_date=timezone.now()+timedelta(days=30))
        self.policy={"resource_capabilities":["mailbox_read","mailbox_create","subdomain_read"]}
        vault=Mock(return_value=(self.row,"synthetic-token",self.policy))
        self.vault=vault
        for target in ("providers.hosting_runtime.load_hosting_connection","services.resource_management.load_hosting_connection"):
            p=patch(target,vault);p.start();self.addCleanup(p.stop)
        self.proof=VerifiedHostingBinding.objects.create(service=self.service,provider_id_snapshot=self.provider.pk,
            account_digest=account_digest(self.service),confirmation_source="provider_api_readback",confirmed_at=timezone.now())
        p=patch("services.resource_management.verify_existing_account");p.start();self.addCleanup(p.stop)
        self.api=APIClient()
        self.api.force_authenticate(self.owner)
        self.base=f"/api/services/opanel/{self.service.pk}"

    def payload(self):
        return {"local":"sales","password":"Only-Synthetic-Password","quota_mb":500,
                "confirm_password":"SyntheticConsolePassword"}

    def test_cross_tenant_and_unverified_scope_never_call_supplier(self):
        with patch.object(ResourceProtocol,"_request") as network:
            self.api.force_authenticate(self.other)
            self.assertEqual(self.api.get(self.base+"/resources/email/").status_code,404)
            self.assertEqual(self.api.post(self.base+"/mailboxes/create/",self.payload(),format="json").status_code,404)
            self.api.force_authenticate(self.owner)
            self.proof.revoked_at=timezone.now()
            self.proof.save(update_fields=["revoked_at"])
            self.assertEqual(self.api.get(self.base+"/resources/email/").status_code,409)
            network.assert_not_called()

    def test_gate_off_and_unauthorized_capability_never_call_supplier(self):
        with patch.object(ResourceProtocol,"_request") as network:
            with self.settings(CLOUD_HOSTING_NATIVE_RESOURCES_ENABLED=False):
                self.assertEqual(self.api.get(self.base+"/resources/email/").status_code,409)
            self.policy["resource_capabilities"]=[]
            self.assertEqual(self.api.get(self.base+"/resources/email/").status_code,409)
            network.assert_not_called()

    def test_success_requires_readback_and_keeps_password_out_of_audit(self):
        with patch.object(ResourceProtocol,"mailboxes",side_effect=[[],[
            {"address":"sales@example.test","quota_mb":500,"unlimited":False}]]),patch.object(
            ResourceProtocol,"mailbox_capacity",return_value=(0,5,5000)),patch.object(
            ResourceProtocol,"create_mailbox") as send:
            result=self.api.post(self.base+"/mailboxes/create/",self.payload(),format="json")
            self.assertEqual(result.status_code,201,result.data)
            send.assert_called_once()
        self.service.refresh_from_db()
        self.assertEqual(self.service.metadata[management.FENCE]["state"],"confirmed")
        self.assertNotIn("Only-Synthetic-Password",str(self.service.metadata))
        from audit.models import AuditLog
        self.assertNotIn("Only-Synthetic-Password",str(list(AuditLog.objects.filter(entity_id=str(self.service.pk)).values("details"))))

    def test_uncertain_creation_blocks_second_write_and_can_reconcile(self):
        with patch.object(ResourceProtocol,"mailboxes",return_value=[]),patch.object(
            ResourceProtocol,"mailbox_capacity",return_value=(0,5,5000)),patch.object(
            ResourceProtocol,"create_mailbox",side_effect=ResourceRefused("timeout")) as send:
            result=self.api.post(self.base+"/mailboxes/create/",self.payload(),format="json")
            self.assertEqual(result.status_code,202,result.data)
            result=self.api.post(self.base+"/mailboxes/create/",self.payload(),format="json")
            self.assertEqual(result.status_code,409,result.data)
            send.assert_called_once()
        self.service.refresh_from_db()
        self.assertEqual(self.service.metadata[management.FENCE]["state"],"dispatched_uncertain")
        self.service.metadata[management.FENCE]["created_at"]=(timezone.now()-timedelta(minutes=3)).isoformat()
        self.service.save(update_fields=["metadata"])
        with patch.object(ResourceProtocol,"mailboxes",return_value=[
            {"address":"sales@example.test","quota_mb":500,"unlimited":False}]),patch.object(
            ResourceProtocol,"create_mailbox") as send:
            result=self.api.post(self.base+"/mailboxes/reconcile/",{},format="json")
            self.assertEqual(result.status_code,200,result.data)
            self.assertEqual(result.data["password_status"],"unverified")
            send.assert_not_called()

    def test_quota_and_password_confirmation_prevent_mutation(self):
        with patch.object(ResourceProtocol,"mailboxes",return_value=[]),patch.object(
            ResourceProtocol,"mailbox_capacity",return_value=(5,5,5000)),patch.object(
            ResourceProtocol,"create_mailbox") as send:
            result=self.api.post(self.base+"/mailboxes/create/",self.payload(),format="json")
            self.assertEqual(result.status_code,409,result.data)
            result=self.api.post(self.base+"/mailboxes/create/",dict(self.payload(),confirm_password="incorrect"),format="json")
            self.assertEqual(result.status_code,403,result.data)
            send.assert_not_called()
