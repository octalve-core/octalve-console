"""Allowlisted operator policies: persisted Settings, not integration credentials.

Only exact reviewed group/key pairs may be changed. No runtime TLS, auth, pricing,
tax, provisioning or email dispatch switches are derived from this store.
"""
from hashlib import sha256
import json
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from .models import Setting, SettingChangeLog

# kind: text, email, tz, select, color, number, footer
MANIFEST = {
 "general": {
  "company_name": ("Company name", "text", "Octalve Cloud", "console_copy"),
  "support_email": ("Support email", "email", "support@octalve.com", "console_copy"),
  "timezone": ("Display timezone", "tz", "Africa/Lagos", "console_copy"),
  "default_language": ("Default language", "select:en,fr", "en", "pilot_only"),
 },
 "theme": {
  "primary_color": ("Primary colour", "select:#0064E0,#0052B8,#135FC7", "#0064E0", "preview_only"),
  "canvas_color": ("Canvas colour", "select:#F6F8FB,#FFFFFF,#F2F7FC", "#F6F8FB", "preview_only"),
  "density": ("Interface density", "select:comfortable,compact", "comfortable", "preview_only"),
 },
 "invoices": {
  "invoice_prefix": ("New invoice prefix", "prefix", "INV", "new_invoices"),
  "invoice_footer": ("Invoice footer", "footer", "", "draft_only"),
  "reminder_days": ("Reminder lead time (days)", "days", "7", "draft_only"),
  "pdf_template": ("Invoice design", "select:template_01", "template_01", "new_invoices"),
 },
 "mail": {
  "sender_name": ("Sender display name", "text", "Octalve Cloud", "draft_only"),
  "reply_to": ("Reply-to address", "email", "support@octalve.com", "draft_only"),
 },
}

def _validated(kind, value):
    if not isinstance(value, str) or value != value.strip() or any(ord(c)<32 and (kind!="footer" or c!="\n") for c in value):
        raise ValueError("Enter a valid value.")
    if kind == "text" and not 2 <= len(value) <= 100:
        raise ValueError("Use 2–100 characters.")
    if kind == "email":
        try:
            validate_email(value)
        except DjangoValidationError:
            raise ValueError("Enter a valid email address.") from None
    if kind == "tz":
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid IANA timezone.") from None
    if kind.startswith("select:") and value not in kind[7:].split(","):
        raise ValueError("Choose a supported option.")
    if kind == "prefix" and not re.fullmatch(r"[A-Z]{2,6}", value):
        raise ValueError("Use 2–6 capital letters for new invoice numbers.")
    if kind == "footer" and len(value) > 500:
        raise ValueError("Limit the footer to 500 characters.")
    if kind == "days" and (not value.isdecimal() or not 1 <= int(value) <= 30):
        raise ValueError("Choose 1–30 days.")
    if len(value) > 500:
        raise ValueError("Value exceeds maximum length.")
    return value

def _records(section, lock=False):
    entries = MANIFEST[section]
    qs = Setting.objects.filter(group__key=section, key__in=entries, is_deprecated=False, is_encrypted=False)
    if lock:
        qs=qs.select_for_update()
    return {item.key:item for item in qs.select_related("group")}

def _snapshot(section, records):
    entries = MANIFEST[section]
    fields = []
    for key, (label, kind, default, effect) in entries.items():
        record = records.get(key)
        stored = record.get_value() if record else default
        value = stored if isinstance(stored,str) else str(stored)
        fields.append({"key":key,"label":label,"kind":kind,"value":value,"effect":effect})
    revision=sha256(json.dumps({f["key"]:f["value"] for f in fields},
        separators=(",",":"),sort_keys=True).encode()+
        b"|" + json.dumps({key:str(records[key].updated_at) if key in records else ""
             for key in entries},sort_keys=True).encode()).hexdigest()
    return {"section":section, "revision":revision, "fields":fields,
            "editable":True,"saved_at":max((v.updated_at for v in records.values()),default=None)}

def read_policy(section):
    if section not in MANIFEST:
        raise KeyError(section)
    return _snapshot(section,_records(section))

@transaction.atomic
def save_policy(section, payload, actor, ip=None):
    if section not in MANIFEST:
        raise KeyError(section)
    if not isinstance(payload,dict) or set(payload)!={"revision","changes"} or (
        not isinstance(payload["revision"],str) or
        not isinstance(payload["changes"],dict) or
        not payload["changes"] or len(payload["changes"])>12):
        raise ValueError("Submit a revision and the exact changed fields.")
    values=payload["changes"]
    if set(values)-set(MANIFEST[section]):
        raise ValueError("This field is not editable.")
    validated={key:_validated(MANIFEST[section][key][1],value)
               for key,value in values.items()}
    # Serialize policy revision checks even when records are still missing.
    from .models import SettingGroup
    # An initial empty registry is valid. Serialize writes by the group row
    # after creation, but compare the exact user-observed default snapshot.
    group,_=SettingGroup.objects.get_or_create(key=section,defaults={
        "name":section.replace("_"," ").title()
    })
    group=SettingGroup.objects.select_for_update().get(pk=group.pk)
    records=_records(section,lock=True)
    before=_snapshot(section,records)
    if payload["revision"]!=before["revision"]:
        raise RuntimeError("Settings changed since you opened this page. Reload and review.")
    # Create default rows only after a matching revision has been approved.
    # No server-controlled values are accepted from metadata in the request.
    for key,(label,kind,default,effect) in MANIFEST[section].items():
        if key not in records:
            Setting.objects.get_or_create(group=group,key=key,defaults={
                "name":label,"data_type":"string","default_value":default,
                "value":default,"is_public":False
            })
    records=_records(section,lock=True)
    changed=[]
    audit_ids=[]
    for key,value in validated.items():
        old=records.get(key)
        if old is None:
            raise RuntimeError("Configuration is not initialized. Run the reviewed migration.")
        if old.is_encrypted or old.data_type in ("password","file","json"):
            raise ValueError("Sensitive settings cannot be changed here.")
        if str(old.get_value() if old.value not in (None,"") else MANIFEST[section][key][2])==value:
            continue
        old.set_value(value)
        log=SettingChangeLog.objects.create(setting=old,changed_by=actor,
            old_value=None,new_value=None,ip_address=ip)
        audit_ids.append(log.pk)
        changed.append(key)
    after=_snapshot(section,_records(section))
    return {**after,"changed":changed,"audit_ids":audit_ids}

def invoice_issuance_policy():
    """Read validated policy just before issuing a NEW invoice only."""
    data=read_policy("invoices")
    values={item["key"]:item["value"] for item in data["fields"]}
    for key in ("invoice_prefix","reminder_days","pdf_template","invoice_footer"):
        _validated(MANIFEST["invoices"][key][1],values[key])
    return {
        "prefix":values["invoice_prefix"],
        "due_days":7,  # Timing remains the certified fixed billing rule until financial gate.
        "footer":values["invoice_footer"],
        "template_id":values["pdf_template"],
        "revision":data["revision"],
    }
