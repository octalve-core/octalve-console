"""B2.8 WORM checkpoint handoff. No AWS credentials or resource creation.

Explicitly provided S3-compatible client permits offline unit tests and a
separately authorized operator. This module NEVER chooses the latest version:
a retained version ID + digest are mandatory verification inputs.
"""
import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

from .audit_checkpoint import MAX_CHECKPOINT_BYTES, _decode
from .connection_vault import VaultUnavailable

_ALLOWED_REGION = re.compile(r"^[a-z0-9-]{5,40}$")
_ALLOWED_BUCKET = re.compile(r"^(?!.*\.\.)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")
_ALLOWED_ACCOUNT = re.compile(r"^\d{12}$")
_ALLOWED_KMS = re.compile(r"^arn:aws:kms:[a-z0-9-]+:\d{12}:key/[a-zA-Z0-9-]+$")
_ALLOWED_VERSION = re.compile(r"^[A-Za-z0-9._~+/=-]{1,1024}$")
_MAX_RETENTION_DAYS = 3650


@dataclass(frozen=True)
class WORMPolicy:
    bucket: str
    account: str
    region: str
    kms_key_arn: str
    retention_days: int

    def validate(self):
        if (not isinstance(self.bucket, str) or not _ALLOWED_BUCKET.fullmatch(self.bucket)
            or not isinstance(self.account, str) or not _ALLOWED_ACCOUNT.fullmatch(self.account)
            or not isinstance(self.region, str) or not _ALLOWED_REGION.fullmatch(self.region)
            or not isinstance(self.kms_key_arn, str) or not _ALLOWED_KMS.fullmatch(self.kms_key_arn)
            or self.kms_key_arn.split(":")[3] != self.region
            or self.kms_key_arn.split(":")[4] != self.account
            or type(self.retention_days) is not int or not 1 <= self.retention_days <= _MAX_RETENTION_DAYS):
            raise VaultUnavailable()
        return self


def _stamp(value):
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise VaultUnavailable()
    return value.astimezone(timezone.utc)


def _key_from_digest(receipt):
    payload = _decode(receipt)  # verifies HMAC, explicit source scope, format
    scope = payload["scope"]
    # Never embed untrusted user-supplied scope in an S3 key.
    scopehash = hashlib.sha256(scope.encode()).hexdigest()[:24]
    digest = hashlib.sha256(receipt).hexdigest()
    return "octalve-provider-audit/v1/" + scopehash + "/" + digest + ".json", digest


def _retention_ok(got_mode, got_date, required):
    return got_mode == "COMPLIANCE" and _stamp(got_date) >= required


def store_locked_receipt(client, policy, receipt, *, now, explicit_approval=False):
    """Upload only to a pre-existing audited locked/versioned bucket, then read back.

    Caller must use an independently scoped, least-privilege AWS client.
    A failed PUT/read-back is an error, NEVER success.
    """
    if explicit_approval is not True:
        raise VaultUnavailable()
    policy.validate()
    if not isinstance(receipt, bytes) or not 0 < len(receipt) <= MAX_CHECKPOINT_BYTES:
        raise VaultUnavailable()
    now_utc = _stamp(now).replace(microsecond=0)
    key, digest = _key_from_digest(receipt)
    retain_until = now_utc + timedelta(days=policy.retention_days)
    try:
        # Validate external bucket WORM settings. Do not create/update buckets.
        lock = client.get_object_lock_configuration(Bucket=policy.bucket, ExpectedBucketOwner=policy.account)
        if lock.get("ObjectLockConfiguration", {}).get("ObjectLockEnabled") != "Enabled":
            raise VaultUnavailable()
        versioning = client.get_bucket_versioning(Bucket=policy.bucket, ExpectedBucketOwner=policy.account)
        if versioning.get("Status") != "Enabled":
            raise VaultUnavailable()
        result = client.put_object(
            Bucket=policy.bucket, Key=key, Body=receipt, ContentType="application/json",
            ServerSideEncryption="aws:kms", SSEKMSKeyId=policy.kms_key_arn,
            ObjectLockMode="COMPLIANCE", ObjectLockRetainUntilDate=retain_until,
            ExpectedBucketOwner=policy.account, IfNoneMatch="*",
            Metadata={"sha256":digest},
        )
        version = result.get("VersionId")
        if not isinstance(version, str) or not _ALLOWED_VERSION.fullmatch(version) or version == "null":
            raise VaultUnavailable()
        # Always pin the *specific version*, never unversioned get_object.
        verify_locked_receipt(client, policy, key=key, version_id=version,
                              expected_sha256=digest, min_retention=retain_until)
        # Receipt contains *only* evidence coordinates, no credentials or keys.
        return {"key": key, "version_id": version, "sha256": digest,
                "bucket": policy.bucket, "account": policy.account,
                "retain_until": retain_until.isoformat()}
    except VaultUnavailable:
        raise
    except Exception as exc:
        # SDK errors are intentionally not emitted into app logs/API.
        raise VaultUnavailable() from exc


def verify_locked_receipt(client, policy, *, key, version_id, expected_sha256, min_retention):
    """Read a pinned immutable version; reject delete markers and mismatched digests."""
    policy.validate()
    if (not isinstance(key, str) or not key.startswith("octalve-provider-audit/v1/")
        or len(key) > 200 or not isinstance(version_id, str)
        or not _ALLOWED_VERSION.fullmatch(version_id)
        or not isinstance(expected_sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_sha256)):
        raise VaultUnavailable()
    min_retention = _stamp(min_retention)
    body_stream = None
    try:
        result = client.get_object(
            Bucket=policy.bucket, Key=key, VersionId=version_id,
            ExpectedBucketOwner=policy.account, ChecksumMode="ENABLED",
        )
        if result.get("DeleteMarker") is True:
            raise VaultUnavailable()
        body_stream = result["Body"]
        blob = body_stream.read(MAX_CHECKPOINT_BYTES + 1)
        if len(blob) > MAX_CHECKPOINT_BYTES or not hmac.compare_digest(
            hashlib.sha256(blob).hexdigest(), expected_sha256
        ):
            raise VaultUnavailable()
        calculated_key, calculated_digest = _key_from_digest(blob)
        if calculated_key != key or calculated_digest != expected_sha256:
            raise VaultUnavailable()
        if not _retention_ok(result.get("ObjectLockMode"), result.get("ObjectLockRetainUntilDate"), min_retention):
            raise VaultUnavailable()
        if (result.get("ServerSideEncryption") != "aws:kms" or
            result.get("SSEKMSKeyId") != policy.kms_key_arn):
            raise VaultUnavailable()
        return blob
    except VaultUnavailable:
        raise
    except Exception as exc:
        raise VaultUnavailable() from exc
    finally:
        if body_stream is not None:
            try:
                body_stream.close()
            except Exception:
                pass
