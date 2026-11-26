"""Public reporting backed by a separately operated Statuspage."""
import json
import re
from time import monotonic

import requests
from urllib3.exceptions import HTTPError

from django.conf import settings
from django.utils.dateparse import parse_datetime

UNKNOWN = {"status": "unknown", "monitoring_available": False}
STATES = {"none": "operational", "minor": "degraded", "major": "outage", "critical": "outage", "maintenance": "maintenance"}
EVENT_STATES = {"investigating", "identified", "monitoring", "resolved", "scheduled", "in_progress", "verifying", "completed", "postmortem"}
SLUG = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")


def status_report():
    subdomain = settings.CLOUD_INDEPENDENT_STATUS_SUBDOMAIN
    page_id = settings.CLOUD_INDEPENDENT_STATUS_PAGE_ID
    if not SLUG.fullmatch(subdomain) or not re.fullmatch(r"[a-z0-9]{6,40}", page_id):
        return UNKNOWN
    deadline = monotonic() + 4
    try:
        with requests.Session() as session:
            session.trust_env = False
            with session.get(f"https://{subdomain}.statuspage.io/api/v2/summary.json",
                             timeout=(2, 2), allow_redirects=False, stream=True) as response:
                if response.status_code != 200:
                    return UNKNOWN
                content = bytearray()
                for chunk in response.iter_content(8192):
                    content.extend(chunk)
                    if len(content) > 262144 or monotonic() >= deadline:
                        return UNKNOWN
        return extract_status(json.loads(content), page_id)
    except (requests.RequestException, HTTPError, OSError, KeyError, TypeError, ValueError, AttributeError):
        return UNKNOWN


def extract_status(packet, page_id):
    if packet["page"]["id"] != page_id or not packet.get("components"):
        return UNKNOWN
    state = STATES.get(packet["status"]["indicator"])
    if not state:
        return UNKNOWN
    events = []
    for field, kind in (("incidents", "incident"), ("scheduled_maintenances", "maintenance")):
        rows = packet[field]
        if not isinstance(rows, list):
            return UNKNOWN
        for item in rows[:20]:
            if item["status"] not in EVENT_STATES or not isinstance(item["name"], str) or len(item["name"]) > 200:
                continue
            if not re.fullmatch(r"[a-z0-9-]{6,40}", item["id"]):
                continue
            updated = parse_datetime(item["updated_at"])
            if updated is None or updated.tzinfo is None:
                continue
            events.append({"id": item["id"], "title": item["name"], "status": item["status"],
                           "kind": kind, "updated_at": updated.isoformat()})
    return {"status": state, "monitoring_available": True, "events": events}
