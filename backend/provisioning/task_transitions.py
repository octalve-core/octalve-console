"""Manual queue transitions are serialized, audited and never execute vendors.

Only read-only inventory sync work can be retried/cancelled here. Changing a
hosting account still requires the separate financial and vendor-proof worker.
"""
from django.db import transaction
from django.utils import timezone

from .models import ProvisioningLog, ProvisioningTask

READ_ONLY_ACTIONS = frozenset(("sync_usage", "sync_details"))


class TaskTransitionRefused(ValueError):
    pass


def transition_task(task_id, *, decision, actor, reason=""):
    if decision not in ("retry", "cancel", "needs_review"):
        raise TaskTransitionRefused("Unsupported task transition.")
    if not isinstance(reason, str) or len(reason) > 240:
        raise TaskTransitionRefused("Review reason must be at most 240 characters.")
    with transaction.atomic():
        task = ProvisioningTask.objects.select_for_update().get(pk=task_id)
        previous = task.status
        if decision == "retry":
            if (task.action not in READ_ONLY_ACTIONS
                    or previous not in ("failed", "retrying")
                    or task.attempt_count >= task.max_attempts):
                raise TaskTransitionRefused("Only eligible read-only sync tasks may retry.")
            task.status = "queued"
            task.scheduled_at = timezone.now()
            task.save(update_fields=["status", "scheduled_at", "updated_at"])
        elif decision == "cancel":
            if task.action not in READ_ONLY_ACTIONS or previous not in ("queued", "retrying"):
                raise TaskTransitionRefused("Only pending read-only sync tasks may be cancelled.")
            task.status = "cancelled"
            task.save(update_fields=["status", "updated_at"])
        else:
            if previous in ("completed", "cancelled", "needs_review"):
                raise TaskTransitionRefused("Task cannot enter review from its current state.")
            task.status = "needs_review"
            task.metadata = {**(task.metadata if isinstance(task.metadata, dict) else {}),
                             "review_reason": reason.strip() or "Operator review requested."}
            task.save(update_fields=["status", "metadata", "updated_at"])
        ProvisioningLog.objects.create(
            task=task, step="manual_state_transition", log_level="warning",
            message="Task status changed by authorized operator.",
            metadata={"decision": decision, "previous_state": previous,
                      "next_state": task.status, "actor_id": str(actor.pk)},
        )
        return task
