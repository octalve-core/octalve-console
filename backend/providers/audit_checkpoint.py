"""Bounded, independently signed provider-audit checkpoints.

No HTTP route, supplier calls, secrets, or storage side effects. A checkpoint
only detects a complete source-DB rollback if its exact bytes are retained
outside the DB under independent write-once custody.
"""
import base64
import binascii
import hashlib
import hmac
import json
import uuid
from datetime import datetime

from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils import timezone

from .connection_audit import MAX_CHAIN, verify_chain
from .connection_models import IntegrationConnection, IntegrationConnectionEvent
from .connection_vault import VaultUnavailable

MAX_CONNECTIONS = 1000
MAX_CHECKPOINT_BYTES = 256 * 1024
DOMAIN = b"octalve-provider-audit-checkpoint-v1\x00"


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def _key():
    encoded = getattr(settings, "CLOUD_PROVIDER_CHECKPOINT_KEY", "")
    others = (
        getattr(settings, "CLOUD_PROVIDER_AUDIT_KEY", ""),
        getattr(settings, "CLOUD_PROVIDER_VAULT_KEY", ""),
        getattr(settings, "CLOUD_PROVIDER_STEPUP_KEY", ""),
        getattr(settings, "CLOUD_PROVIDER_RECOVERY_KEY", ""),
        getattr(settings, "ENCRYPTION_KEY", ""),
    )
    if not isinstance(encoded, str) or not encoded or encoded in others:
        raise VaultUnavailable()
    try:
        material = base64.b64decode(encoded, altchars=b"-_", validate=True)
        if len(material) != 32:
            raise ValueError("Incorrect checkpoint key length")
    except (ValueError, TypeError, binascii.Error) as exc:
        raise VaultUnavailable() from exc
    return material


def _sign(payload):
    return hmac.new(_key(), DOMAIN + _canonical(payload), hashlib.sha256).hexdigest()


def _decode(document):
    if not isinstance(document, bytes) or len(document) > MAX_CHECKPOINT_BYTES:
        raise VaultUnavailable()
    try:
        envelope = json.loads(document)
        if not isinstance(envelope, dict) or set(envelope) != {"payload", "mac"}:
            raise ValueError("Invalid envelope")
        payload, mac = envelope["payload"], envelope["mac"]
        if not isinstance(payload, dict) or set(payload) != {"format", "generated_at", "connections"}:
            raise ValueError("Invalid payload")
        if payload["format"] != "octalve-provider-audit-checkpoint-v1":
            raise ValueError("Unknown checkpoint format")
        if not isinstance(mac, str) or len(mac) != 64 or not hmac.compare_digest(_sign(payload), mac):
            raise ValueError("Checkpoint signature mismatch")
        when = datetime.fromisoformat(payload["generated_at"])
        if when.tzinfo is None or when.utcoffset() is None:
            raise ValueError("Missing timestamp offset")
        entries = payload["connections"]
        if not isinstance(entries, list) or len(entries) > MAX_CONNECTIONS:
            raise ValueError("Invalid connection count")
        previous = ""
        for entry in entries:
            if not isinstance(entry, dict) or set(entry) != {"id", "sequence", "head"}:
                raise ValueError("Invalid entry")
            identifier = entry["id"]
            if not isinstance(identifier, str) or str(uuid.UUID(identifier)) != identifier or identifier <= previous:
                raise ValueError("Invalid connection order")
            previous = identifier
            sequence, head = entry["sequence"], entry["head"]
            if type(sequence) is not int or not 1 <= sequence <= MAX_CHAIN:
                raise ValueError("Invalid checkpoint sequence")
            if not isinstance(head, str) or len(head) != 64 or any(c not in "0123456789abcdef" for c in head):
                raise ValueError("Invalid checkpoint head")
        return payload
    except (ValueError, TypeError, KeyError, OverflowError, UnicodeError) as exc:
        raise VaultUnavailable() from exc


def build_audit_checkpoint():
    """Read and cryptographically verify all source chains before signing."""
    if not getattr(settings, "CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED", False):
        raise VaultUnavailable()
    _key()
    try:
        with transaction.atomic():
            rows = list(IntegrationConnection.objects.select_for_update().order_by("pk")[:MAX_CONNECTIONS + 1])
            if len(rows) > MAX_CONNECTIONS:
                raise VaultUnavailable()
            entries = []
            for row in rows:
                verify_chain(row)
                # Unsequenced draft records must not become independently attested.
                if row.audit_sequence < 1 or row.audit_sequence > MAX_CHAIN:
                    raise VaultUnavailable()
                entries.append({
                    "id": str(row.pk), "sequence": row.audit_sequence, "head": row.audit_head,
                })
            payload = {
                "format": "octalve-provider-audit-checkpoint-v1",
                "generated_at": timezone.now().isoformat(),
                "connections": entries,
            }
            receipt = _canonical({"payload": payload, "mac": _sign(payload)})
            if len(receipt) > MAX_CHECKPOINT_BYTES:
                raise VaultUnavailable()
            return receipt
    except DatabaseError as exc:
        raise VaultUnavailable() from exc


def verify_audit_checkpoint(document):
    """Verify trusted external bytes against the CURRENT DB, even after new events.

    The caller must supply the last independently retained checkpoint; comparing
    to a replaceable local file is not an anti-rollback assurance.
    """
    payload = _decode(document)
    try:
        with transaction.atomic():
            rows = list(IntegrationConnection.objects.select_for_update().order_by("pk")[:MAX_CONNECTIONS + 1])
            if len(rows) > MAX_CONNECTIONS:
                raise VaultUnavailable()
            current = {str(row.pk): row for row in rows}
            for row in rows:
                verify_chain(row)
            for entry in payload["connections"]:
                row = current.get(entry["id"])
                if row is None or row.audit_sequence < entry["sequence"]:
                    raise VaultUnavailable()
                # Compare the *historical* checkpoint event, not just the
                # current head; legitimate rotations after export are allowed.
                recorded = IntegrationConnectionEvent.objects.filter(
                    connection=row, sequence=entry["sequence"]
                ).values_list("event_mac", flat=True).first()
                if not isinstance(recorded, str) or not hmac.compare_digest(recorded, entry["head"]):
                    raise VaultUnavailable()
            return {
                "verified_checkpoint_connections": len(payload["connections"]),
                "current_connections": len(rows),
                "new_connections": len(rows) - len(payload["connections"]),
                "integrity_verified": True,
            }
    except DatabaseError as exc:
        raise VaultUnavailable() from exc
