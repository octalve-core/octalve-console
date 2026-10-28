"""B2.8 bounded read-only evidence for *coherent* audit + isolated vault recovery.

A passing review drill is not a full Neon/service/file/mail disaster recovery.
No API, provider calls, secret export, persistent snapshot or source mutation.
"""
import hashlib
import json
from django.db import transaction
from django.conf import settings
from .audit_checkpoint import build_audit_checkpoint, verify_audit_checkpoint, _decode
from .isolated_recovery import (
    backup_cipher, build_isolated_snapshot, verify_isolated_snapshot,
)
from .connection_vault import VaultUnavailable

MAX_REVIEW_CONNECTIONS = 250


@transaction.atomic
def verify_coherent_review_recovery():
    """Accept only matching signed checkpoint and independently validated snapshot.

    Both source reads share one DB transaction. If a supplier credential rotates
    between readings, either the DB transaction locks it or coherence fails.
    """
    if not (
        getattr(settings, "CLOUD_PROVIDER_SNAPSHOT_REVIEW_ENABLED", False)
        and getattr(settings, "CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED", False)
    ):
        raise VaultUnavailable()
    snapshot = build_isolated_snapshot()
    counts = verify_isolated_snapshot(snapshot)
    checkpoint = build_audit_checkpoint()
    checkpoint_report = verify_audit_checkpoint(checkpoint)
    if (not counts["isolated"] or not counts["connections"]
            or not counts["versions"] or not counts["events"]
            or counts["connections"] > MAX_REVIEW_CONNECTIONS
            or counts["connections"] != checkpoint_report["verified_checkpoint_connections"]):
        raise VaultUnavailable()
    # Both envelopes were independently authenticated above. Check that they
    # describe the same precise set of committed audit heads, not only counts.
    try:
        stored = json.loads(backup_cipher().decrypt(snapshot))
        signed = _decode(checkpoint)
        snapshot_heads = {
            row["id"]: (row["sequence"], row["head"])
            for row in stored["connections"]
        }
        checkpoint_heads = {
            row["id"]: (row["sequence"], row["head"])
            for row in signed["connections"]
        }
    except (ValueError, TypeError, KeyError) as exc:
        raise VaultUnavailable() from exc
    if (len(snapshot_heads) != counts["connections"]
            or len(checkpoint_heads) != counts["connections"]
            or snapshot_heads != checkpoint_heads):
        raise VaultUnavailable()

    return {
        "scope": signed["scope"],
        "snapshot_sha256": hashlib.sha256(snapshot).hexdigest(),
        "checkpoint_sha256": hashlib.sha256(checkpoint).hexdigest(),
        "connections": counts["connections"],
        "credential_versions": counts["versions"],
        "signed_events": counts["events"],
        "isolated_sqlite": True,
        "checkpoint_rollback_check": True,
        "full_neon_restore": False,
        "external_worm_certified": False,
        "production_readiness": False,
    }
