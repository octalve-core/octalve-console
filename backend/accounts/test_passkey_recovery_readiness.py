"""Disposable DB-only recovery lifecycle with real synthetic WebAuthn signatures."""
import hashlib
import json
from io import StringIO

import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase
from webauthn.helpers import bytes_to_base64url as b64
from audit.models import AuditLog
from .models import PrivilegedPasskey, PrivilegedLoginChallenge

RP = "console.cloud.octalve.com"
ORIGIN = "https://" + RP
PASSWORD = "AUTH03C disposable fixture password"
LOGIN = "/api/auth/jwt/create/"
ENROLL = "/api/auth/passkeys/enroll/"


class SoftwareAuthenticator:
    """Real software signatures and none attestation; not a physical device."""
    def __init__(self, identifier):
        self.identifier = identifier
        self.private = ec.generate_private_key(ec.SECP256R1())
        point = self.private.public_key().public_numbers()
        self.cose = cbor2.dumps({1:2,3:-7,-1:1,-2:point.x.to_bytes(32,"big"),-3:point.y.to_bytes(32,"big")})

    def register(self, challenge, origin=ORIGIN):
        data = json.dumps({"type":"webauthn.create","challenge":challenge,"origin":origin,"crossOrigin":False}).encode()
        auth = hashlib.sha256(RP.encode()).digest()+bytes([0x45])+bytes(4)+bytes(16)+len(self.identifier).to_bytes(2,"big")+self.identifier+self.cose
        obj = cbor2.dumps({"fmt":"none","attStmt":{},"authData":auth})
        return {"id":b64(self.identifier),"rawId":b64(self.identifier),"type":"public-key",
            "response":{"clientDataJSON":b64(data),"attestationObject":b64(obj)}}

    def assertion(self, challenge, count=1):
        data = json.dumps({"type":"webauthn.get","challenge":challenge,"origin":ORIGIN,"crossOrigin":False}).encode()
        auth = hashlib.sha256(RP.encode()).digest()+bytes([5])+count.to_bytes(4,"big")
        sig = self.private.sign(auth+hashlib.sha256(data).digest(),ec.ECDSA(hashes.SHA256()))
        return {"id":b64(self.identifier),"rawId":b64(self.identifier),"type":"public-key",
            "response":{"clientDataJSON":b64(data),"authenticatorData":b64(auth),"signature":b64(sig),"userHandle":None}}


@override_settings(CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=True,CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=False)
class RecoveryReadinessTests(APITestCase):
    def setUp(self):
        User=get_user_model()
        self.owner=User.objects.create_superuser(email="owner03c@example.invalid",username="owner03c",password=PASSWORD)
        self.drill=User.objects.create_user(email="drill03c@example.invalid",username="drill03c",password=PASSWORD,role="staff",is_staff=False,is_superuser=False)
        self.customer=User.objects.create_user(email="client03c@example.invalid",username="client03c",password=PASSWORD)
        self.owner_key=PrivilegedPasskey.objects.create(user=self.owner,credential_id="b3duZXI",public_key=b"untouched fixture")
        self.old=SoftwareAuthenticator(b"auth03c-old")
        self.new=SoftwareAuthenticator(b"auth03c-replacement")
        self.creds={"email":self.drill.email,"password":PASSWORD}

    def code(self, recovery=False):
        output=StringIO()
        args={"account_id":self.drill.pk,"approval_reference":"fixture-change","confirm_independent_approval":True,"recovery":recovery,"stdout":output,"stderr":StringIO()}
        if recovery: args["notification_reference"]="fixture-pre-notification"
        call_command("issue_privileged_passkey_grant",**args)
        return output.getvalue().strip()

    def enroll(self, code, authenticator, origin=ORIGIN):
        body={"code":code,"password":PASSWORD}
        started=self.client.post(ENROLL,body,format="json")
        self.assertEqual(started.status_code,200,started.data)
        return self.client.post(ENROLL,{**body,"credential":authenticator.register(started.data["public_key"]["challenge"],origin)},format="json")

    def begin(self):
        result=self.client.post(LOGIN,{**self.creds,"passkey_qualification":True},format="json")
        self.assertEqual(result.status_code,428,result.data)
        return result.data

    def finish(self, challenge, authenticator):
        return self.client.post(LOGIN,{**self.creds,"passkey_qualification":True,"passkey_challenge":challenge["challenge_id"],"passkey_continuation":challenge["continuation"],"passkey_assertion":authenticator.assertion(challenge["public_key"]["challenge"])},format="json")

    def test_recovery_real_registration_and_assertion_revokes_only_drill(self):
        self.assertEqual(self.enroll(self.code(),self.old).status_code,201)
        previous=self.finish(self.begin(),self.old)
        self.assertEqual(previous.status_code,200,previous.data)
        stale=self.begin()
        password_session=APIClient()
        password_session.force_login(self.drill)
        self.assertEqual(password_session.get("/api/auth/me/").status_code,200)
        owner_password=self.owner.password
        with self.assertRaises(CommandError):
            call_command("issue_privileged_passkey_grant",account_id=self.drill.pk,approval_reference="fixture-change",confirm_independent_approval=True,recovery=True,stdout=StringIO())
        # Invalid origin consumes the grant but cannot revoke any credentials.
        wrong=self.enroll(self.code(True),self.new,"https://wrong.example.invalid")
        self.assertEqual(wrong.status_code,403,wrong.data)
        self.assertEqual(PrivilegedPasskey.objects.filter(user=self.drill,revoked_at__isnull=True).count(),1)
        self.assertEqual(self.enroll(self.code(True),self.new).status_code,201)
        self.assertIsNotNone(PrivilegedLoginChallenge.objects.get(pk=stale["challenge_id"]).used_at)
        old_client=APIClient()
        old_client.credentials(HTTP_AUTHORIZATION="Bearer "+previous.data["access"])
        self.assertEqual(old_client.get("/api/auth/me/").status_code,401)
        self.assertEqual(old_client.post("/api/auth/jwt/refresh/",{"refresh":previous.data["refresh"]},format="json").status_code,401)
        self.assertEqual(password_session.get("/api/auth/me/").status_code,401)
        self.assertEqual(self.finish(stale,self.old).status_code,403)
        fresh=self.finish(self.begin(),self.new)
        self.assertEqual(fresh.status_code,200,fresh.data)
        self.assertTrue(fresh.data["passkey_verified"])
        self.owner.refresh_from_db()
        self.owner_key.refresh_from_db()
        self.assertEqual(self.owner.password,owner_password)
        self.assertIsNone(self.owner_key.revoked_at)
        event=AuditLog.objects.get(entity_type="privileged_passkey",entity_id=str(self.drill.pk),entity_name="Privileged passkey recovered")
        args={"account_id":self.drill.pk,"recovery_audit_id":event.pk,"approval_reference":"fixture-change","notification_reference":"fixture-post-notification","confirm_independent_delivery":True,"stdout":StringIO()}
        with self.assertRaises(CommandError):
            call_command("record_passkey_recovery_notification",**{**args,"account_id":self.owner.pk})
        call_command("record_passkey_recovery_notification",**args)
        call_command("record_passkey_recovery_notification",**args)
        self.assertEqual(AuditLog.objects.filter(entity_name="Recovery notification delivery recorded",entity_id=str(self.drill.pk)).count(),1)

    @override_settings(CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=True)
    def test_ordinary_customer_login_refresh_and_logout_under_enforcement(self):
        client=APIClient()
        result=client.post(LOGIN,{"email":self.customer.email,"password":PASSWORD},format="json")
        self.assertEqual(result.status_code,200,result.data)
        client.credentials(HTTP_AUTHORIZATION="Bearer "+result.data["access"])
        self.assertEqual(client.get("/api/auth/me/").status_code,200)
        self.assertEqual(client.get("/api/auth/passkeys/").status_code,403)
        rotated=client.post("/api/auth/jwt/refresh/",{"refresh":result.data["refresh"]},format="json")
        self.assertEqual(rotated.status_code,200,rotated.data)
        client.credentials(HTTP_AUTHORIZATION="Bearer "+rotated.data["access"])
        self.assertEqual(client.post("/api/auth/logout/",{"refresh":rotated.data["refresh"]},format="json").status_code,200)
        self.assertEqual(client.get("/api/auth/me/").status_code,401)
