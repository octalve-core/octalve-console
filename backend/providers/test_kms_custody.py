"""Synthetic KMS custody acceptance. No AWS account or network dependency."""
from cryptography.fernet import Fernet
from django.test import SimpleTestCase
from providers.kms_custody import KMSCustodyPolicy,wrap_key,unwrap_key,rotate_kms_wrapping
from providers.connection_vault import VaultUnavailable

ARN1="arn:aws:kms:eu-west-1:123456789012:key/11111111-1111-4111-8111-111111111111"
ARN2="arn:aws:kms:eu-west-1:123456789012:key/22222222-2222-4222-8222-222222222222"
SRC=KMSCustodyPolicy(key_arn=ARN1,scope="octalve-console:synthetic-review")
DST=KMSCustodyPolicy(key_arn=ARN2,scope="octalve-console:synthetic-review")


class FakeKMS:
    def __init__(self):
        self.objects={}
        self.sequence=0
        self.down=False

    def _write(self, key, context, plaintext):
        self.sequence+=1
        blob=f"ci-nonfunctional-envelope-{self.sequence}".encode()
        self.objects[blob]=(key,context.copy(),plaintext)
        return blob

    def encrypt(self,**kwargs):
        if self.down: raise RuntimeError("Simulated KMS outage")
        blob=self._write(kwargs["KeyId"],kwargs["EncryptionContext"],kwargs["Plaintext"])
        return {"KeyId":kwargs["KeyId"],"CiphertextBlob":blob}

    def decrypt(self,**kwargs):
        if self.down: raise RuntimeError("Simulated KMS outage")
        key,context,value=self.objects[kwargs["CiphertextBlob"]]
        if key!=kwargs["KeyId"] or context!=kwargs["EncryptionContext"]:
            raise ValueError("Wrong key/context")
        return {"KeyId":key,"Plaintext":value}

    def re_encrypt(self,**kwargs):
        if self.down: raise RuntimeError("Simulated KMS outage")
        key,context,value=self.objects[kwargs["CiphertextBlob"]]
        if key!=kwargs["SourceKeyId"] or context!=kwargs["SourceEncryptionContext"]:
            raise ValueError("Wrong source key/context")
        blob=self._write(kwargs["DestinationKeyId"],kwargs["DestinationEncryptionContext"],value)
        return {"SourceKeyId":key,"KeyId":kwargs["DestinationKeyId"],"CiphertextBlob":blob}


class KMSCustodyTests(SimpleTestCase):
    def setUp(self):
        self.kms=FakeKMS()
        self.key=Fernet.generate_key().decode()

    def test_recover_after_kms_reencrypt_without_printing_plaintext(self):
        doc=wrap_key(self.kms,SRC,version="v1",plaintext_fernet=self.key,explicit_approval=True)
        self.assertEqual(doc["version"],"v1")
        self.assertEqual(doc["kms_key_arn"],ARN1)
        self.assertNotIn(self.key,repr(doc))
        self.assertEqual(unwrap_key(self.kms,SRC,doc),self.key)
        rotated=rotate_kms_wrapping(self.kms,SRC,DST,doc,explicit_approval=True)
        self.assertNotEqual(doc["wrapped_key"],rotated["wrapped_key"])
        self.assertEqual(unwrap_key(self.kms,DST,rotated),self.key)
        # Historical source remains readable until separate key retirement approval.
        self.assertEqual(unwrap_key(self.kms,SRC,doc),self.key)

    def test_wrong_scope_key_version_and_ciphertext_fail_shut(self):
        doc=wrap_key(self.kms,SRC,version="v1",plaintext_fernet=self.key,explicit_approval=True)
        with self.assertRaises(VaultUnavailable):
            unwrap_key(self.kms,KMSCustodyPolicy(ARN1,"octalve-console:production"),doc)
        with self.assertRaises(VaultUnavailable):
            unwrap_key(self.kms,DST,doc)
        forged=dict(doc,version="v2")
        with self.assertRaises(VaultUnavailable):
            unwrap_key(self.kms,SRC,forged)
        forged=dict(doc,wrapped_key="eA==")
        with self.assertRaises(VaultUnavailable):
            unwrap_key(self.kms,SRC,forged)

    def test_approval_and_storage_outage_fail_closed(self):
        with self.assertRaises(VaultUnavailable):
            wrap_key(self.kms,SRC,version="v1",plaintext_fernet=self.key)
        self.assertEqual(self.kms.sequence,0)
        doc=wrap_key(self.kms,SRC,version="v1",plaintext_fernet=self.key,explicit_approval=True)
        with self.assertRaises(VaultUnavailable):
            rotate_kms_wrapping(self.kms,SRC,DST,doc)
        self.kms.down=True
        with self.assertRaises(VaultUnavailable):
            unwrap_key(self.kms,SRC,doc)
        with self.assertRaises(VaultUnavailable):
            rotate_kms_wrapping(self.kms,SRC,DST,doc,explicit_approval=True)

    def test_policy_refuses_bad_arn_key_or_scope(self):
        for policy in (KMSCustodyPolicy("alias/not-an-arn",SRC.scope),
                       KMSCustodyPolicy(ARN1,""),
                       KMSCustodyPolicy(ARN1,"../secret?")):
            with self.assertRaises(VaultUnavailable):
                wrap_key(self.kms,policy,version="v1",plaintext_fernet=self.key,explicit_approval=True)
        with self.assertRaises(VaultUnavailable):
            wrap_key(self.kms,SRC,version="v1",plaintext_fernet="not-a-key",explicit_approval=True)
        with self.assertRaises(VaultUnavailable):
            wrap_key(self.kms,SRC,version="../../bad",plaintext_fernet=self.key,explicit_approval=True)
        self.assertEqual(self.kms.sequence,0)
