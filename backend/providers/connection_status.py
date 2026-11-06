"""Read-only provider verification evidence for operator UI.

These status labels report the LAST authenticated read-only check. They are
NOT authorization for DNS writes, purchases, provisioning or customer use.
No client has access to the admin connection registry.
"""
from datetime import timedelta
from django.utils import timezone
from audit.models import AuditLog

# Recent proof for an explicit UI "Verified" label. Older evidence remains
# visible as a historical check, not current authority.
VERIFICATION_FRESHNESS=timedelta(days=7)
VERIFICATION_HISTORY=timedelta(days=180)
MAX_AUDIT_ROWS=5000


def verification_receipts(rows):
    """One bounded query; match connection ID, adapter and secret version.

    AuditLog is informational, not an immutable supplier-operation authority.
    It can never enable vendor writes. Missing/truncated receipts fail closed
    to 'Awaiting verification', never false positive.
    """
    ids={str(row.pk):row for row in rows if row.state=="draft"}
    if not ids:
        return {}
    since=timezone.now()-VERIFICATION_HISTORY
    receipts={}
    candidates=(AuditLog.objects.filter(
        action="provider_connection_test",
        entity_type="IntegrationConnection",
        entity_id__in=list(ids),
        created_at__gte=since,
        details__verified=True,
        details__read_only=True,
        details__execution_enabled=False,
    ).values("entity_id","entity_name","created_at","details")
     .order_by("-created_at","-pk")[:MAX_AUDIT_ROWS])
    for receipt in candidates:
        key=receipt["entity_id"]
        row=ids.get(key)
        if not row or key in receipts:
            continue
        details=receipt["details"]
        if (not isinstance(details,dict)
                or details.get("adapter")!=row.adapter_key
                or receipt["entity_name"]!=row.adapter_key
                or type(details.get("credential_version")) is not int
                or details["credential_version"]!=row.current_version
                or receipt["created_at"]<row.updated_at):
            # A receipt predating the current key rotation cannot verify a
            # subsequently generated credential version, even if its version
            # number happens to match.
            continue
        receipts[key]=receipt["created_at"]
    return receipts


def safe_verification_status(row, receipts):
    """Display-only state; no operational permission may consult this result."""
    if row.state=="revoked":
        return {"verification_status":"revoked","last_verified_at":None}
    checked=receipts.get(str(row.pk))
    if checked is None:
        return {"verification_status":"awaiting_verification","last_verified_at":None}
    return {
        "verification_status":"verified" if checked>=timezone.now()-VERIFICATION_FRESHNESS
            else "recheck_required",
        "last_verified_at":checked.isoformat(),
    }
