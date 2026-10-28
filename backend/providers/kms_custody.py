"""B2.9 offline AWS KMS envelope custody primitives, no automatic AWS access.

A separately approved KMS client must be injected. This is a key escrow/
rotation building block, not an activated Console provider vault keyring.
AWS KMS encryption contexts are nonsecret and appear in CloudTrail.
"""
import base64
import binascii
import re
from dataclasses import dataclass
from cryptography.fernet import Fernet

from .connection_vault import VaultUnavailable, valid_key

_ARN = re.compile(r"^arn:aws:kms:([a-z0-9-]{5,40}):(\d{12}):key/([a-zA-Z0-9-]{10,128})$")
_KEY_ID = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
_SCOPE = re.compile(r"^[A-Za-z0-9_.:/-]{3,128}$")
_MAX_BLOB = 6144


@dataclass(frozen=True)
class KMSCustodyPolicy:
    key_arn: str
    scope: str

    def validate(self):
        if (not isinstance(self.key_arn, str) or not _ARN.fullmatch(self.key_arn)
            or not isinstance(self.scope, str) or not _SCOPE.fullmatch(self.scope)):
            raise VaultUnavailable()
        return self


def _context(policy, version):
    policy.validate()
    if not isinstance(version, str) or not _KEY_ID.fullmatch(version):
        raise VaultUnavailable()
    return {"octalve:purpose":"provider-vault-fernet-key",
            "octalve:scope":policy.scope,"octalve:key-version":version}


def _encode(blob):
    if not isinstance(blob, (bytes,bytearray)) or not 0 < len(blob) <= _MAX_BLOB:
        raise VaultUnavailable()
    return base64.b64encode(blob).decode("ascii")


def _decode(blob):
    if not isinstance(blob, str) or not blob or len(blob)>_MAX_BLOB*2:
        raise VaultUnavailable()
    try:
        raw=base64.b64decode(blob,validate=True)
        if len(raw)>_MAX_BLOB or not raw:
            raise ValueError("Invalid blob size")
        return raw
    except (ValueError,TypeError,binascii.Error) as exc:
        raise VaultUnavailable() from exc


def _invoke(client, method, **kwargs):
    if client is None:
        raise VaultUnavailable()
    try:
        result=getattr(client,method)(**kwargs)
    except Exception as exc:
        raise VaultUnavailable() from exc
    if not isinstance(result,dict):
        raise VaultUnavailable()
    return result


def wrap_key(client, policy, *, version, plaintext_fernet, explicit_approval=False):
    """Encrypt a 32-byte historical/current Fernet key under KMS, no logging."""
    if explicit_approval is not True:
        raise VaultUnavailable()
    context=_context(policy,version)
    valid_key(plaintext_fernet)
    binary=base64.urlsafe_b64decode(plaintext_fernet)
    result=_invoke(client,"encrypt",KeyId=policy.key_arn,Plaintext=binary,
                   EncryptionContext=context,EncryptionAlgorithm="SYMMETRIC_DEFAULT")
    if result.get("KeyId")!=policy.key_arn:
        raise VaultUnavailable()
    return {"version":version,"kms_key_arn":policy.key_arn,
            "wrapped_key":_encode(result.get("CiphertextBlob"))}


def unwrap_key(client, policy, record):
    """Return transient Fernet key, never output to HTTP/log or persist plaintext."""
    policy.validate()
    if not isinstance(record,dict) or set(record)!={"version","kms_key_arn","wrapped_key"}:
        raise VaultUnavailable()
    if record["kms_key_arn"]!=policy.key_arn:
        raise VaultUnavailable()
    context=_context(policy,record["version"])
    result=_invoke(client,"decrypt",KeyId=policy.key_arn,
                   CiphertextBlob=_decode(record["wrapped_key"]),
                   EncryptionContext=context,EncryptionAlgorithm="SYMMETRIC_DEFAULT")
    plaintext=result.get("Plaintext")
    if result.get("KeyId")!=policy.key_arn or not isinstance(plaintext,bytes) or len(plaintext)!=32:
        raise VaultUnavailable()
    key=base64.urlsafe_b64encode(plaintext).decode("ascii")
    valid_key(key)
    return key


def rotate_kms_wrapping(client, source_policy, destination_policy, record, *,
                         explicit_approval=False):
    """KMS ReEncrypt of existing wrapped data key, no plaintext at this layer."""
    if explicit_approval is not True:
        raise VaultUnavailable()
    source_policy.validate()
    destination_policy.validate()
    if not isinstance(record,dict) or set(record)!={"version","kms_key_arn","wrapped_key"}:
        raise VaultUnavailable()
    if record["kms_key_arn"]!=source_policy.key_arn:
        raise VaultUnavailable()
    version=record["version"]
    src=_context(source_policy,version)
    dst=_context(destination_policy,version)
    result=_invoke(client,"re_encrypt",
                   CiphertextBlob=_decode(record["wrapped_key"]),
                   SourceKeyId=source_policy.key_arn,
                   SourceEncryptionContext=src,
                   DestinationKeyId=destination_policy.key_arn,
                   DestinationEncryptionContext=dst)
    if (result.get("SourceKeyId")!=source_policy.key_arn or
        result.get("KeyId")!=destination_policy.key_arn):
        raise VaultUnavailable()
    return {"version":version,"kms_key_arn":destination_policy.key_arn,
            "wrapped_key":_encode(result.get("CiphertextBlob"))}
