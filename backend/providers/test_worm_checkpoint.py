"""Synthetic B2.8 WORM qualification: no AWS requests or real credentials."""
import io
import copy
from datetime import datetime, timezone, timedelta

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase, override_settings

from providers.audit_checkpoint import build_audit_checkpoint, verify_audit_checkpoint
from providers.connection_audit import append_event
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from providers.worm_checkpoint import WORMPolicy, store_locked_receipt, verify_locked_receipt

AUDIT=Fernet.generate_key().decode()
CHECKPOINT=Fernet.generate_key().decode()
KMS="arn:aws:kms:eu-west-1:123456789012:key/12345678-1234-4234-8234-123456789abc"
POLICY=WORMPolicy(bucket="octalve-security-auditor-synthetic",account="123456789012",
                  region="eu-west-1",kms_key_arn=KMS,retention_days=90)
NOW=datetime(2026,10,28,12,0,tzinfo=timezone.utc)


class SyntheticWORMClient:
    def __init__(self):
        self.storage={}
        self.lock=True
        self.versioning=True
        self.fail_read=False
        self.changed={}
        self.puts=0

    def get_object_lock_configuration(self,**kwargs):
        return {"ObjectLockConfiguration":{"ObjectLockEnabled":"Enabled" if self.lock else "Disabled"}}

    def get_bucket_versioning(self,**kwargs):
        return {"Status":"Enabled" if self.versioning else "Suspended"}

    def put_object(self,**kwargs):
        self.puts+=1
        obj=(kwargs["Key"],"SYNTHETIC-VERSION-1")
        if obj in self.storage: raise ValueError("Overwrite blocked")
        self.storage[obj]=kwargs
        return {"VersionId":obj[1]}

    def get_object(self,**kwargs):
        if self.fail_read: raise RuntimeError("Synthetic storage outage")
        row=self.storage[(kwargs["Key"],kwargs["VersionId"])]
        out={"Body":io.BytesIO(row["Body"]),
             "ObjectLockMode":row["ObjectLockMode"],
             "ObjectLockRetainUntilDate":row["ObjectLockRetainUntilDate"],
             "ServerSideEncryption":row["ServerSideEncryption"],
             "SSEKMSKeyId":row["SSEKMSKeyId"]}
        out.update(self.changed)
        return out


@override_settings(CLOUD_PROVIDER_AUDIT_KEY=AUDIT,CLOUD_PROVIDER_CHECKPOINT_KEY=CHECKPOINT,
    CLOUD_PROVIDER_CHECKPOINT_SCOPE="octalve-console:synthetic-ci",
    CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED=True)
class WORMHandoffTests(TestCase):
    def setUp(self):
        actor=get_user_model().objects.create_superuser(
            email="worm-ci@example.invalid",username="worm-ci",password="CI-synthetic-no-real-password")
        with transaction.atomic():
            row=IntegrationConnection.objects.create(
                adapter_key="resend",label="Synthetic",environment="test",
                public_settings={"sending_domain":"example.invalid"})
            append_event(row,actor,"draft_created",1)
        self.receipt=build_audit_checkpoint()
        self.client=SyntheticWORMClient()

    def store(self):
        return store_locked_receipt(self.client,POLICY,self.receipt,now=NOW,explicit_approval=True)

    def test_approved_append_only_version_and_isolated_verified_readback(self):
        artifact=self.store()
        self.assertEqual(artifact["version_id"],"SYNTHETIC-VERSION-1")
        self.assertEqual(artifact["bucket"],POLICY.bucket)
        self.assertTrue(artifact["key"].startswith("octalve-provider-audit/v1/"))
        self.assertNotIn("example.invalid",str(artifact))
        blob=verify_locked_receipt(
            self.client,POLICY,key=artifact["key"],version_id=artifact["version_id"],
            expected_sha256=artifact["sha256"],min_retention=NOW+timedelta(days=90))
        self.assertEqual(blob,self.receipt)
        self.assertTrue(verify_audit_checkpoint(blob)["integrity_verified"])
        with self.assertRaises(VaultUnavailable):
            self.store()  # never overwrite the same digest/key
        self.assertEqual(len(self.client.storage),1)

    def test_no_approval_no_locked_bucket_or_versioning_no_write(self):
        with self.assertRaises(VaultUnavailable):
            store_locked_receipt(self.client,POLICY,self.receipt,now=NOW)
        self.client.lock=False
        with self.assertRaises(VaultUnavailable): self.store()
        self.client.lock=True
        self.client.versioning=False
        with self.assertRaises(VaultUnavailable): self.store()
        self.assertEqual(self.client.puts,0)

    def test_fail_closed_on_readback_outage_and_wrong_retention(self):
        self.client.fail_read=True
        with self.assertRaises(VaultUnavailable): self.store()
        self.client.fail_read=False
        self.client.changed={"ObjectLockMode":"GOVERNANCE"}
        with self.assertRaises(VaultUnavailable):
            verify_locked_receipt(self.client,POLICY,
                key=next(iter(self.client.storage))[0],version_id="SYNTHETIC-VERSION-1",
                expected_sha256=__import__("hashlib").sha256(self.receipt).hexdigest(),
                min_retention=NOW+timedelta(days=90))
        self.client.changed={"ObjectLockRetainUntilDate":NOW+timedelta(days=2)}
        with self.assertRaises(VaultUnavailable):
            verify_locked_receipt(self.client,POLICY,
                key=next(iter(self.client.storage))[0],version_id="SYNTHETIC-VERSION-1",
                expected_sha256=__import__("hashlib").sha256(self.receipt).hexdigest(),
                min_retention=NOW+timedelta(days=90))

    def test_corruption_wrong_kms_scope_and_version_rejected(self):
        item=self.store()
        (key,version),saved=next(iter(self.client.storage.items()))
        saved["Body"]=b"corrupt"
        with self.assertRaises(VaultUnavailable):
            verify_locked_receipt(self.client,POLICY,key=item["key"],
                version_id=item["version_id"],expected_sha256=item["sha256"],
                min_retention=NOW+timedelta(days=90))
        saved["Body"]=self.receipt
        self.client.changed={"SSEKMSKeyId":"arn:aws:kms:eu-west-1:999999999999:key/wrong"}
        with self.assertRaises(VaultUnavailable):
            verify_locked_receipt(self.client,POLICY,key=item["key"],
                version_id=item["version_id"],expected_sha256=item["sha256"],
                min_retention=NOW+timedelta(days=90))
        self.client.changed={}
        with self.assertRaises(VaultUnavailable):
            verify_locked_receipt(self.client,POLICY,key=item["key"],
                version_id="NOT-THE-VERSION",expected_sha256=item["sha256"],
                min_retention=NOW+timedelta(days=90))
        with override_settings(CLOUD_PROVIDER_CHECKPOINT_SCOPE="octalve-console:other-ci"):
            with self.assertRaises(VaultUnavailable):
                verify_locked_receipt(self.client,POLICY,key=item["key"],
                    version_id=item["version_id"],expected_sha256=item["sha256"],
                    min_retention=NOW+timedelta(days=90))

    def test_policy_rejects_cross_account_kms_and_bad_retention(self):
        for bad in (
            WORMPolicy(bucket=POLICY.bucket,account="bad",region=POLICY.region,
                       kms_key_arn=KMS,retention_days=90),
            WORMPolicy(bucket=POLICY.bucket,account=POLICY.account,region="us-east-1",
                       kms_key_arn=KMS,retention_days=90),
            WORMPolicy(bucket=POLICY.bucket,account=POLICY.account,region=POLICY.region,
                       kms_key_arn=KMS,retention_days=0),
        ):
            with self.assertRaises(VaultUnavailable):
                store_locked_receipt(self.client,bad,self.receipt,now=NOW,explicit_approval=True)
        self.assertEqual(self.client.puts,0)
