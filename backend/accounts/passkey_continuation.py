"""Signed, password-bound proof of a successful first stage; never an access token."""
from django.core import signing
from django.utils.crypto import salted_hmac, constant_time_compare

SALT = "octalve-webauthn-login-continuation-v1"


def _binding(identifier, password, challenge):
    # The HMAC is not an unkeyed password hash and cannot be used to guess
    # passwords offline. Length-prefix components via JSON, not delimiters.
    import json
    value = json.dumps([identifier.strip().casefold(), password, challenge], separators=(",", ":"))
    return salted_hmac(SALT + "-binding", value, algorithm="sha256").hexdigest()


def issue_continuation(identifier, password, challenge):
    return signing.dumps({"challenge": challenge, "binding": _binding(identifier, password, challenge)}, salt=SALT)


def valid_continuation(payload):
    if not isinstance(payload, dict):
        return False
    ticket = payload.get("passkey_continuation")
    challenge = payload.get("passkey_challenge")
    identifier = payload.get("email") or payload.get("username")
    password = payload.get("password")
    if not (isinstance(ticket, str) and 1 <= len(ticket) <= 1024
            and isinstance(challenge, str) and len(challenge) == 36
            and isinstance(identifier, str) and 1 <= len(identifier) <= 254
            and isinstance(password, str) and 1 <= len(password) <= 1024
            and isinstance(payload.get("passkey_assertion"), dict)):
        return False
    try:
        data = signing.loads(ticket, salt=SALT, max_age=120)
        return (isinstance(data, dict) and data.get("challenge") == challenge
                and isinstance(data.get("binding"), str)
                and constant_time_compare(data["binding"], _binding(identifier, password, challenge)))
    except (signing.BadSignature, ValueError, TypeError):
        return False
