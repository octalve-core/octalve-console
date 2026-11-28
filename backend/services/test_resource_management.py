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

    def test_forwarding_inventory_scoped_and_special_routes_unmanaged(self):
        da=self.adapter("directadmin")
        with patch.object(da,"_request",return_value=SupplierReadResponse(200,b"sales=person%40external.test&support=%3Ablackhole%3A")):
            self.assertEqual(da.forwarders(),[
                {"address":"sales@example.test","destination":"person@external.test","managed":True},
                {"address":"support@example.test","destination":None,"managed":False}])
        cp=self.adapter("cpanel-whm")
        payload={"cpanelresult":{"apiversion":2,"module":"Email","func":"listforwards","event":{"result":1},"data":[{"forward":"sales@example.test","dest":"person@external.test"}]}}
        with patch.object(cp,"_request",return_value=reply(payload)):
            self.assertEqual(cp.forwarders(),[{"address":"sales@example.test","destination":"person@external.test","managed":True}])
        payload["cpanelresult"]["data"][0]["forward"]="victim@external.test"
        with patch.object(cp,"_request",return_value=reply(payload)),self.assertRaises(ResourceRefused):
            cp.forwarders()

    def test_autoresponder_inventory_omits_message_and_cc_and_requires_exact_domain(self):
        da=self.adapter("directadmin")
        with patch.object(da,"_request",return_value=SupplierReadResponse(200,b"sales=private%40external.test&support=")):
            self.assertEqual(da.autoresponders(),["sales@example.test","support@example.test"])
        for payload in (b"",b"sales=a&sales=b",b"error=1"):
            with patch.object(da,"_request",return_value=SupplierReadResponse(200,payload)),self.assertRaises(ResourceRefused):
                da.autoresponders()
        cp=self.adapter("cpanel-whm")
        with patch.object(cp,"_request",return_value=whm("Email","list_auto_responders",[{"email":"sales@example.test","subject":"private","body":"private"}])):
            self.assertEqual(cp.autoresponders(),["sales@example.test"])
        with patch.object(cp,"_request",return_value=whm("Email","list_auto_responders",[])):
            self.assertEqual(cp.autoresponders(),[])
        for rows in ([{"email":"sales@other.test"}],[{"email":"sales@example.test"},{"email":"sales@example.test"}]):
            with patch.object(cp,"_request",return_value=whm("Email","list_auto_responders",rows)),self.assertRaises(ResourceRefused):
                cp.autoresponders()

    def test_autoresponder_transport_is_fixed_and_account_scoped(self):
        da=self.adapter("directadmin")
        da._check_request("GET","/CMD_API_EMAIL_AUTORESPONDER",{"domain":"example.test"},False)
        for method,fields in (("POST",{"domain":"example.test"}),("GET",{"domain":"other.test"}),("GET",{"domain":"example.test","action":"delete"})):
            with self.assertRaises(ResourceRefused):
                da._check_request(method,"/CMD_API_EMAIL_AUTORESPONDER",fields,False)
        cp=self.adapter("cpanel-whm")
        fields={"api.version":"1","cpanel.user":"checkhost","cpanel.module":"Email","cpanel.function":"list_auto_responders","domain":"example.test"}
        cp._check_request("GET","/json-api/uapi_cpanel",fields,False)
        for change in ({"domain":"other.test"},{"cpanel.user":"other"},{"cpanel.function":"delete_auto_responder"}):
            with self.assertRaises(ResourceRefused):
                cp._check_request("GET","/json-api/uapi_cpanel",{**fields,**change},False)
        with self.assertRaises(VaultUnavailable):
            validate_resource_capabilities(["autoresponder_read"])
        with self.assertRaises(VaultUnavailable):
            validate_resource_capabilities(["mailbox_read","autoresponder_delete"])
        with patch.object(da,"_request",return_value=SupplierReadResponse(200,b"error=0")) as send:
            da.delete_autoresponder("sales")
            send.assert_called_once_with("POST","/CMD_API_EMAIL_AUTORESPONDER",{"action":"delete","domain":"example.test","select0":"sales"})
        with patch.object(cp,"_request",return_value=whm("Email","delete_auto_responder",None)) as send:
            cp.delete_autoresponder("sales")
            self.assertEqual(send.call_args.args[2]["email"],"sales@example.test")
        for email in ("sales@other.test","root@example.test","sales","checkhost@example.test"):
            with self.assertRaises(ResourceRefused):
                cp._check_request("POST","/json-api/uapi_cpanel",{**{k:v for k,v in fields.items() if k!="domain"},"cpanel.function":"delete_auto_responder","email":email},False)
        self.assertEqual(validate_resource_capabilities(["mailbox_read","autoresponder_read"]),["autoresponder_read","mailbox_read"])

    def test_autoresponder_write_contract_and_exact_content_readback(self):
        da=self.adapter("directadmin")
        with patch.object(da,"_request",side_effect=[SupplierReadResponse(200,b"error=0"),SupplierReadResponse(200,b"user=sales&email=&subject=Away&text=Back+soon&reply_encoding=UTF-8&reply_content_type=text%2Fplain&reply_once_time=2d")]) as send:
            da.save_autoresponder("sales","Away","Back soon")
            self.assertEqual(send.call_args.args[2]["cc"],"OFF")
            self.assertEqual(da.autoresponder_content("sales"),("Away","Back soon"))
        cp=self.adapter("cpanel-whm")
        with patch.object(cp,"_request",side_effect=[whm("Email","add_auto_responder",None),whm("Email","get_auto_responder",{"subject":"Away","body":"Back soon","from":"sales@example.test","charset":"UTF-8","interval":48,"start":0,"stop":0,"is_html":0})]) as send:
            cp.save_autoresponder("sales","Away","Back soon")
            self.assertEqual(send.call_args.args[2]["interval"],"48")
            self.assertEqual(cp.autoresponder_content("sales"),("Away","Back soon"))
        with patch.object(cp,"_request") as send:
            with self.assertRaises(ResourceRefused):
                cp.save_autoresponder("sales","Away","Back soon",edit=True)
            with self.assertRaises(ResourceRefused):
                cp.save_autoresponder("sales","Away\nBcc: bad","Back soon")
            send.assert_not_called()

    def test_secure_mail_settings_account_identity_and_no_external_host(self):
        cp=self.adapter("cpanel-whm")
        row={"account":"sales@example.test","domain":"example.test","inbox_username":"sales@example.test","smtp_username":"sales@example.test","inbox_service":"imap","inbox_host":"supplier.example.test","smtp_host":"supplier.example.test","inbox_port":993,"smtp_port":465}
        with patch.object(cp,"_request",return_value=whm("Email","get_client_settings",row)):
            self.assertEqual(cp.mail_client_settings("sales")["imap_port"],993)
        for change in ({"smtp_host":"other.test"},{"account":"victim@example.test"},{"smtp_port":25}):
            with patch.object(cp,"_request",return_value=whm("Email","get_client_settings",{**row,**change})),self.assertRaises(ResourceRefused):
                cp.mail_client_settings("sales")

    def test_webmail_session_rejects_wrong_origin_port_mailbox_and_service(self):
        from services.native_panel import parse_session,NativePanelRefused
        address="sales@example.test"
        origin="https://supplier.example.test:2087"
        token="/cpsess1234567890"
        session=address+":abcdef1234567890"
        from urllib.parse import urlencode
        url="https://supplier.example.test:2096"+token+"/login?"+urlencode({"session":session})
        data={"expires":int(timezone.now().timestamp())+60,"service":"webmaild","url":url,"session":session,"cp_security_token":token}
        def response(d):
            return reply({"metadata":{"command":"create_user_session","result":1},"data":d})
        self.assertEqual(parse_session(response(data),origin,"cpanel-whm",address,service="webmaild"),url)
        for change in ({"url":url.replace("2096","2083")},{"url":url.replace("supplier.example.test","other.test")},{"service":"cpaneld"},{"session":"other@example.test:abc"}):
            with self.assertRaises(NativePanelRefused):
                parse_session(response({**data,**change}),origin,"cpanel-whm",address,service="webmaild")

    def test_forwarder_transport_disallows_unowned_source_and_pipe(self):
        cp=self.adapter("cpanel-whm")
        base={"api.version":"1","cpanel.user":"checkhost","cpanel.module":"Email","cpanel.function":"add_forwarder","domain":"example.test","email":"sales@example.test","fwdopt":"fwd","fwdemail":"person@external.test"}
        cp._check_request("POST","/json-api/uapi_cpanel",base,False)
        for change in ({"email":"victim@external.test"},{"fwdemail":"|/bin/sh"},{"fwdemail":"sales@example.test"},{"fwdopt":"pipe"},{"cpanel.user":"victim"}):
            with self.assertRaises(ResourceRefused):
                cp._check_request("POST","/json-api/uapi_cpanel",{**base,**change},False)
        da=self.adapter("directadmin")
        da._check_request("POST","/CMD_API_EMAIL_FORWARDERS",{"action":"create","domain":"example.test","user":"sales","email":"person@external.test"},False)
        with self.assertRaises(ResourceRefused):
            da._check_request("POST","/CMD_API_EMAIL_FORWARDERS",{"action":"create","domain":"example.test","user":"sales","email":":blackhole:"},False)

    def test_transport_rejects_unknown_commands_and_cross_account_before_connecting(self):
        da=self.adapter("directadmin")
        whm=self.adapter("cpanel-whm")
        with patch("services.resource_protocol.approved_origin") as origin:
            for protocol,method,path,fields in (
                (da,"GET","/CMD_API_POP",{"action":"delete","domain":"example.test","user":"sales"}),
                (da,"GET","/CMD_API_SUBDOMAINS",{"domain":"other.test"}),
                (whm,"POST","/json-api/uapi_cpanel",{"api.version":"1","cpanel.user":"victim","cpanel.module":"Email","cpanel.function":"add_pop","email":"sales","domain":"example.test","password":"synthetic","quota":"500"}),
                (whm,"GET","/json-api/uapi_cpanel",{"api.version":"1","cpanel.user":"checkhost","cpanel.module":"Fileman","cpanel.function":"delete_file"})):
                with self.assertRaises(ResourceRefused):
                    protocol._request(method,path,fields)
            origin.assert_not_called()

    def test_duplicate_supplier_json_fields_refused(self):
        protocol=self.adapter("directadmin")
        with patch.object(protocol,"_request",return_value=SupplierReadResponse(200,b'{"info":{"quota":"500"},"info":{"quota":"1000"}}')):
            with self.assertRaises(ResourceRefused):
                protocol.mailboxes()

    def test_mutation_protocols_use_fixed_scoped_commands(self):
        da=self.adapter("directadmin")
        with patch.object(da,"_request",return_value=SupplierReadResponse(200,b"error=0&text=ok")) as send:
            da.change_mailbox_quota("sales",500)
            self.assertEqual(send.call_args.args[2]["quota"],"500MB")
            da.delete_mailbox("sales")
            self.assertEqual(send.call_args.args[2],{"action":"delete","domain":"example.test","user":"sales"})
            da.create_subdomain("shop")
            self.assertEqual(send.call_args.args[2]["subdomain"],"shop")
            da.delete_subdomain("shop")
            self.assertEqual(send.call_args.args[2]["contents"],"no")
        whm_adapter=self.adapter("cpanel-whm")
        with patch.object(whm_adapter,"_request",side_effect=[
                whm("Email","delete_pop",None),whm("Email","edit_pop_quota",None)]) as send:
            whm_adapter.delete_mailbox("sales")
            whm_adapter.change_mailbox_quota("sales",500)
            self.assertEqual(send.call_args_list[0].args[2]["cpanel.user"],"checkhost")
            self.assertEqual(send.call_args.args[2]["quota"],"500")
        with patch.object(whm_adapter,"_request",return_value=whm("SubDomain","addsubdomain",None)) as send:
            whm_adapter.create_subdomain("shop")
            self.assertEqual(send.call_args.args[2]["rootdomain"],"example.test")
            self.assertEqual(send.call_args.args[2]["dir"],"/public_html/shop")
        with patch.object(whm_adapter,"subdomain_created",return_value=True),patch.object(
                whm_adapter,"_subdomain_api2",return_value=[{"result":1}]) as send:
            whm_adapter.delete_subdomain("shop")
            send.assert_called_once_with("POST","delsubdomain",{"domain":"shop.example.test"})
        with patch.object(whm_adapter,"subdomains",return_value=["shop.example.test"]),patch.object(
                whm_adapter,"_subdomain_api2",return_value=[{"domain":"shop.example.test","rootdomain":"example.test","subdomain":"shop","basedir":"public_html/other"}]):
            self.assertFalse(whm_adapter.subdomain_created("shop.example.test"))

    def test_database_inventory_checks_exact_account_prefix(self):
        da=self.adapter("directadmin")
        with patch.object(da,"_request",return_value=SupplierReadResponse(200,b"list%5B%5D=checkhost_site")):
            self.assertEqual(da.databases(),["checkhost_site"])
        whm_adapter=self.adapter("cpanel-whm")
        with patch.object(whm_adapter,"_request",return_value=whm("Mysql","list_databases",[{"database":"checkhost_site","users":["private"]}])):
            self.assertEqual(whm_adapter.databases(),["checkhost_site"])
        with patch.object(whm_adapter,"_request",return_value=whm("Mysql","list_databases",[{"database":"other_site"}])),self.assertRaises(ResourceRefused):
            whm_adapter.databases()

    def test_hosting_password_reseller_target_and_da_verification(self):
        da=self.adapter("directadmin")
        secret="SyntheticHostingPassword123!"
        with patch.object(da,"_request",side_effect=[SupplierReadResponse(200,b"error=0"),SupplierReadResponse(200,b"valid=1")]) as send:
            da.reset_hosting_password(secret)
            self.assertTrue(da.verify_hosting_password(secret))
            self.assertEqual(send.call_args_list[0].args[2]["username"],"checkhost")
            self.assertTrue(send.call_args_list[0].kwargs["reseller"])
            self.assertEqual(send.call_args.args[2]["user"],"checkhost")
        with self.assertRaises(ResourceRefused):
            da._check_request("POST","/CMD_API_USER_PASSWD",{"username":"victim","passwd":secret,"passwd2":secret},True)

    def test_database_mutations_and_privileges_scoped_to_account(self):
        da=self.adapter("directadmin")
        with patch.object(da,"_request",return_value=SupplierReadResponse(200,b"error=0")) as send:
            da.create_database("site",initial_user="app",password="SyntheticDatabasePassword!")
            self.assertEqual(send.call_args.args[2]["name"],"site")
            da.create_database_user("app","SyntheticDatabasePassword!","checkhost_site")
            self.assertEqual(send.call_args.args[2]["name"],"checkhost_site")
            da.set_database_grants("checkhost_site","checkhost_app","read_only")
            self.assertEqual(send.call_args.args[2]["grant"],"N")
            self.assertEqual(send.call_args.args[2]["select"],"Y")
            self.assertEqual(send.call_args.args[2]["delete"],"N")
        with self.assertRaises(ResourceRefused):
            da.set_database_grants("victim_site","checkhost_app","read_only")
        whm_adapter=self.adapter("cpanel-whm")
        with patch.object(whm_adapter,"_request",return_value=whm("Mysql","set_privileges_on_database",None)) as send:
            whm_adapter.set_database_grants("checkhost_site","checkhost_app","read_write")
            self.assertEqual(send.call_args.args[2]["privileges"],"SELECT,INSERT,UPDATE,DELETE")
        with self.assertRaises(ResourceRefused):
            whm_adapter.set_database_grants("checkhost_site","checkhost_app","ALL PRIVILEGES")

    def test_file_inventory_rejects_symlink_root_and_filters_non_owned_items(self):
        cp=self.adapter("cpanel-whm")
        root="/home/checkhost/public_html"
        directory={"type":"dir","fullpath":root,"exists":1,"mode":16877,"uid":1234}
        files=[{"file":"index.html","type":"file","fullpath":root+"/index.html","exists":1,"mode":33188,"uid":1234,"size":100},
               {"file":"link","type":"link","fullpath":root+"/link","exists":1,"mode":41471,"uid":1234,"size":3},
               {"file":"victim","type":"file","fullpath":"/home/other/victim","exists":1,"mode":33188,"uid":999,"size":50}]
        with patch.object(cp,"_request",side_effect=[whm("Fileman","get_file_information",directory),whm("Fileman","list_files",files),whm("Fileman","get_file_information",directory)]):
            self.assertEqual(cp.website_files(),[{"name":"index.html","kind":"file","size_bytes":100}])
        with patch.object(cp,"_request",return_value=whm("Fileman","get_file_information",{**directory,"type":"link","mode":41471})),self.assertRaises(ResourceRefused):
            cp.website_files()
        with self.assertRaises(ResourceRefused):
            cp._check_request("GET","/json-api/uapi_cpanel",{"api.version":"1","cpanel.user":"checkhost","cpanel.module":"Fileman","cpanel.function":"list_files","dir":"/etc","show_hidden":"0"},False)
        da=self.adapter("directadmin")
        with self.assertRaises(ResourceRefused):
            da._check_request("GET","/CMD_API_FILE_MANAGER",{"path":"/domains/other.test/public_html"},False)

    def test_database_password_dispatch_is_scoped_and_ack_is_not_proof(self):
        password="SyntheticDatabasePassword!"
        da=self.adapter("directadmin")
        with patch.object(da,"databases",return_value=["checkhost_site"]),patch.object(
                da,"database_users",return_value=["checkhost_app"]),patch.object(
                da,"_request",return_value=SupplierReadResponse(200,b"error=0")) as send:
            self.assertIsNone(da.dispatch_database_user_password("checkhost_app",password,"checkhost_site"))
            self.assertEqual(send.call_args.args[2],{"action":"modify","name":"checkhost_site",
                            "user":"checkhost_app","passwd":password,"passwd2":password})
            with self.assertRaises(ResourceRefused):
                da.dispatch_database_user_password("checkhost_other",password,"checkhost_site")
            self.assertEqual(send.call_count,1)
        with self.assertRaises(ResourceRefused):
            da._check_request("POST","/CMD_API_DB_USER",{"action":"modify","name":"victim_site",
                              "user":"checkhost_app","passwd":password,"passwd2":password},False)
        cp=self.adapter("cpanel-whm")
        with patch.object(cp,"all_database_users",return_value=["checkhost_app"]),patch.object(
                cp,"_request",return_value=whm("Mysql","set_password",{"failures":[]})) as send:
            self.assertIsNone(cp.dispatch_database_user_password("checkhost_app",password))
            self.assertEqual(send.call_args.args[2]["user"],"checkhost_app")
            send.return_value=whm("Mysql","set_password",{"failures":["server"]})
            with self.assertRaises(ResourceRefused):
                cp.dispatch_database_user_password("checkhost_app",password)

    def test_invalid_names_and_capability_dependency(self):
        for name in ("root","cpanel","postmaster","../x","x@other.test","x..y","a."):
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

    def test_autoresponder_inventory_route_owner_and_capability(self):
        path=self.base+"/resources/autoresponders/"
        with patch.object(ResourceProtocol,"autoresponders",return_value=["sales@example.test"]) as read,patch.object(ResourceProtocol,"mailboxes",return_value=[{"address":"sales@example.test"}]):
            self.assertEqual(self.api.get(path).status_code,409)
            self.policy["resource_capabilities"].append("autoresponder_read")
            self.api.force_authenticate(self.other)
            self.assertEqual(self.api.get(path).status_code,404)
            read.assert_not_called()
            self.api.force_authenticate(self.owner)
            response=self.api.get(path)
            self.assertEqual(response.status_code,200,response.data)
            self.assertEqual(response.data["items"],["sales@example.test"])
            self.assertEqual(response.data["resource"],"autoresponders")
            read.assert_called_once()

    def test_autoresponder_creation_requires_exact_content_readback(self):
        self.policy["resource_capabilities"].extend(["autoresponder_read","autoresponder_create"])
        data={"local":"sales","reply_subject":"Away","reply_body":"Back soon","confirm_password":"SyntheticConsolePassword"}
        with patch("services.resource_management.audit_keyring",return_value=("fixture",{"fixture":b"x"*32})),patch.object(ResourceProtocol,"autoresponders",side_effect=[[],["sales@example.test"]]),patch.object(ResourceProtocol,"mailboxes",return_value=[{"address":"sales@example.test"}]),patch.object(ResourceProtocol,"autoresponder_content",return_value=("Away","Back soon")),patch.object(ResourceProtocol,"save_autoresponder") as write:
            response=self.api.post(self.base+"/resource-actions/autoresponder_create/",data,format="json")
            self.assertEqual(response.status_code,200,response.data)
            write.assert_called_once_with("sales","Away","Back soon",edit=False)
        self.service.refresh_from_db()
        self.assertNotIn("Back soon",str(self.service.metadata))
        self.assertEqual(self.service.metadata[management.FENCE]["state"],"confirmed")

    def test_autoresponder_removal_requires_capability_confirmation_and_absence(self):
        path=self.base+"/resource-actions/autoresponder_delete/"
        data={"local":"sales","confirm_target":"sales@example.test","confirm_password":"SyntheticConsolePassword"}
        with patch.object(ResourceProtocol,"autoresponders",side_effect=[["sales@example.test"],[]]),patch.object(ResourceProtocol,"delete_autoresponder") as send:
            self.assertEqual(self.api.post(path,data,format="json").status_code,409)
            self.policy["resource_capabilities"].extend(["autoresponder_read","autoresponder_delete"])
            self.assertEqual(self.api.post(path,{**data,"confirm_target":"other@example.test"},format="json").status_code,409)
            send.assert_not_called()
            response=self.api.post(path,data,format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("sales")
        self.service.refresh_from_db()
        self.assertEqual(self.service.metadata[management.FENCE]["state"],"confirmed")

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


    def test_delete_requires_exact_confirmation_and_supplier_absence(self):
        self.policy["resource_capabilities"].append("mailbox_delete")
        path=self.base+"/resource-actions/mailbox_delete/"
        data={"local":"sales","confirm_target":"other@example.test","confirm_password":"SyntheticConsolePassword"}
        row={"address":"sales@example.test","quota_mb":500,"unlimited":False}
        with patch.object(ResourceProtocol,"mailboxes",side_effect=[[row],[]]),patch.object(ResourceProtocol,"delete_mailbox") as send:
            response=self.api.post(path,data,format="json")
            self.assertEqual(response.status_code,409,response.data)
            send.assert_not_called()
            data["confirm_target"]="sales@example.test"
            response=self.api.post(path,data,format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("sales")
        self.service.refresh_from_db()
        self.assertEqual(self.service.metadata[management.FENCE]["state"],"confirmed")

    def test_quota_timeout_is_readback_only_and_no_duplicate_write(self):
        self.policy["resource_capabilities"].append("mailbox_quota")
        path=self.base+"/resource-actions/mailbox_quota/"
        data={"local":"sales","quota_mb":700,"confirm_password":"SyntheticConsolePassword"}
        before={"address":"sales@example.test","quota_mb":500,"unlimited":False}
        after={"address":"sales@example.test","quota_mb":700,"unlimited":False}
        with patch.object(ResourceProtocol,"mailboxes",return_value=[before]),patch.object(ResourceProtocol,"mailbox_capacity",return_value=(1,5,5000)),patch.object(ResourceProtocol,"change_mailbox_quota",side_effect=ResourceRefused("uncertain")) as send:
            self.assertEqual(self.api.post(path,data,format="json").status_code,202)
            self.assertEqual(self.api.post(path,data,format="json").status_code,409)
            send.assert_called_once()
        self.service.refresh_from_db()
        self.service.metadata[management.FENCE]["created_at"]=(timezone.now()-timedelta(minutes=3)).isoformat()
        self.service.save(update_fields=["metadata"])
        with patch.object(ResourceProtocol,"mailboxes",return_value=[after]),patch.object(ResourceProtocol,"change_mailbox_quota") as send:
            response=self.api.post(self.base+"/resource-actions/reconcile/",{},format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_not_called()

    def test_database_create_delete_and_readback(self):
        self.policy["resource_capabilities"].extend(["database_read","database_create","database_delete"])
        with patch.object(ResourceProtocol,"databases",side_effect=[[],["checkhost_site"]]),patch.object(
                ResourceProtocol,"database_capacity",return_value=(0,5)),patch.object(ResourceProtocol,"create_database") as send:
            response=self.api.post(self.base+"/resource-actions/database_create/",
                {"local":"site","confirm_password":"SyntheticConsolePassword"},format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("site",initial_user=None,password=None)
        with patch.object(ResourceProtocol,"databases",side_effect=[["checkhost_site"],[]]),patch.object(
                ResourceProtocol,"delete_database") as send:
            response=self.api.post(self.base+"/resource-actions/database_delete/",
                {"local":"checkhost_site","confirm_target":"checkhost_site","confirm_password":"SyntheticConsolePassword"},format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("checkhost_site")

    def test_database_grant_requires_owned_database_and_exact_profile(self):
        self.policy["resource_capabilities"].extend(["database_read","database_user_read","database_grants"])
        with patch.object(ResourceProtocol,"databases",return_value=["checkhost_site"]),patch.object(
                ResourceProtocol,"all_database_users",return_value=["checkhost_app"]),patch.object(
                ResourceProtocol,"database_grants",return_value=["SELECT"]),patch.object(ResourceProtocol,"set_database_grants") as send:
            response=self.api.post(self.base+"/resource-actions/database_grants/",
                {"local":"checkhost_app","database":"checkhost_site","profile":"read_only","confirm_password":"SyntheticConsolePassword"},format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("checkhost_site","checkhost_app","read_only")
    def test_subdomain_mutations_disabled_without_signed_capability(self):
        with patch.object(ResourceProtocol,"create_subdomain") as send:
            response=self.api.post(self.base+"/resource-actions/subdomain_create/",{"local":"shop","confirm_password":"SyntheticConsolePassword"},format="json")
            self.assertEqual(response.status_code,409,response.data)
            send.assert_not_called()


    def test_password_change_uncertain_recovery_verifies_original_password_only(self):
        self.policy["resource_capabilities"].append("mailbox_password")
        path=self.base+"/resource-actions/mailbox_password/"
        new_password="Synthetic-New-Mailbox-Password"
        row={"address":"sales@example.test","quota_mb":500,"unlimited":False}
        data={"local":"sales","password":new_password,"confirm_password":"SyntheticConsolePassword"}
        with patch("services.resource_management.audit_keyring",return_value=("fixture",{"fixture":b"x"*32})),patch.object(
                ResourceProtocol,"mailboxes",return_value=[row]),patch.object(
                ResourceProtocol,"change_mailbox_password",side_effect=ResourceRefused("uncertain")) as send:
            self.assertEqual(self.api.post(path,data,format="json").status_code,202)
            send.assert_called_once_with("sales",new_password,500)
            self.service.refresh_from_db()
            self.assertNotIn(new_password,str(self.service.metadata))
            self.service.metadata[management.FENCE]["created_at"]=(timezone.now()-timedelta(minutes=3)).isoformat()
            self.service.save(update_fields=["metadata"])
            recovery=self.base+"/resource-actions/reconcile/"
            with patch.object(ResourceProtocol,"verify_mailbox_password",return_value=True) as verify:
                wrong={"password":"Synthetic-Wrong-Mailbox-Password","confirm_password":"SyntheticConsolePassword"}
                self.assertEqual(self.api.post(recovery,wrong,format="json").status_code,202)
                verify.assert_not_called()
                right={**wrong,"password":new_password}
                response=self.api.post(recovery,right,format="json")
                self.assertEqual(response.status_code,200,response.data)
                verify.assert_called_once_with("sales",new_password)
            send.assert_called_once()
        self.service.refresh_from_db()
        self.assertEqual(self.service.metadata[management.FENCE]["state"],"confirmed")
        self.assertNotIn("password_receipt",self.service.metadata[management.FENCE])

    def test_forwarder_write_and_delete_require_exact_readback(self):
        self.policy["resource_capabilities"].extend(["forwarder_read","forwarder_create","forwarder_delete"])
        mailbox={"address":"sales@example.test","quota_mb":500,"unlimited":False}
        route={"address":"sales@example.test","destination":"person@external.test","managed":True}
        data={"local":"sales","destination":"person@external.test","confirm_password":"SyntheticConsolePassword"}
        with patch.object(ResourceProtocol,"mailboxes",return_value=[mailbox]),patch.object(
                ResourceProtocol,"forwarders",side_effect=[[],[route]]),patch.object(ResourceProtocol,"create_forwarder") as send:
            response=self.api.post(self.base+"/resource-actions/forwarder_create/",data,format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("sales","person@external.test")
        with patch.object(ResourceProtocol,"mailboxes",return_value=[mailbox]),patch.object(
                ResourceProtocol,"forwarders",side_effect=[[route],[]]),patch.object(ResourceProtocol,"delete_forwarder") as send:
            response=self.api.post(self.base+"/resource-actions/forwarder_delete/",{**data,"confirm_target":"wrong"},format="json")
            self.assertEqual(response.status_code,409,response.data)
            send.assert_not_called()
            response=self.api.post(self.base+"/resource-actions/forwarder_delete/",{**data,"confirm_target":"sales@example.test -> person@external.test"},format="json")
            self.assertEqual(response.status_code,200,response.data)
            send.assert_called_once_with("sales","person@external.test")
