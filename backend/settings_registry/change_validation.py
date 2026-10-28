"""Strict, no-write review of a limited set of non-sensitive Console settings.

This never applies changes. Policy, MFA, approval, audit retention and key
custody must be separately accepted before adding an apply operation.
"""
import re
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email

POLICY = {
    ("general", "company_name"): "name",
    ("general", "support_email"): "email",
    ("theme", "accent_color"): "hex_color",
    ("invoices", "invoice_footer"): "footer",
}


class SettingChangeRefused(ValueError):
    pass


def validate_change(setting, payload):
    if not isinstance(payload, dict) or set(payload) != {"value"}:
        raise SettingChangeRefused("Only the proposed value is accepted.")
    if (setting.is_deprecated or setting.is_encrypted or
            setting.data_type in ("password", "file", "json")):
        raise SettingChangeRefused("This setting cannot be changed here.")
    kind = POLICY.get((setting.group.key, setting.key))
    if kind is None:
        raise SettingChangeRefused("This setting is not in the reviewed change policy.")
    value = payload["value"]
    if not isinstance(value, str) or value != value.strip() or any(ord(c) < 32 for c in value):
        raise SettingChangeRefused("Use a clean text value.")
    if kind == "name" and not 2 <= len(value) <= 100:
        raise SettingChangeRefused("Company name must be 2 to 100 characters.")
    if kind == "email":
        if not 3 <= len(value) <= 254:
            raise SettingChangeRefused("Invalid support email.")
        try:
            validate_email(value)
        except DjangoValidationError:
            raise SettingChangeRefused("Invalid support email.") from None
    if kind == "hex_color" and not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        raise SettingChangeRefused("Color must use the #RRGGBB format.")
    if kind == "footer" and len(value) > 500:
        raise SettingChangeRefused("Invoice footer is too long.")
    if not value and kind != "footer":
        raise SettingChangeRefused("Value is required.")
    # Do not return a secret or the value itself in the review response.
    return {"setting_id": setting.pk, "key": setting.key, "data_type": kind,
            "valid": True, "requires_approval": True, "applied": False}
