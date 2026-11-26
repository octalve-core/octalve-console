"""Bounded fixed-origin clients for the public Google tools."""
import json
import re
from time import monotonic

import requests
from urllib3.exceptions import HTTPError

GEMINI_MODEL = "gemini-3.1-flash-lite"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}"
PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


class PublicGoogleUnavailable(ValueError):
    pass


def _request(url, key, *, params=None, payload=None, limit=32768, seconds=8):
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", key):
        raise PublicGoogleUnavailable()
    deadline = monotonic() + seconds
    try:
        with requests.Session() as connection:
            connection.trust_env = False
            with connection.request(
                "POST" if payload is not None else "GET", url,
                params=params, json=payload,
                headers={"X-Goog-Api-Key": key, "Accept": "application/json", "Accept-Encoding": "identity"},
                timeout=(3, seconds), allow_redirects=False, stream=True,
            ) as response:
                if response.status_code != 200:
                    raise PublicGoogleUnavailable()
                data = bytearray()
                for chunk in response.iter_content(chunk_size=8192):
                    data.extend(chunk)
                    if len(data) > limit or monotonic() >= deadline:
                        raise PublicGoogleUnavailable()
        packet = json.loads(data)
        if not isinstance(packet, dict):
            raise PublicGoogleUnavailable()
        return packet
    except (requests.RequestException, HTTPError, OSError, TypeError, ValueError):
        raise PublicGoogleUnavailable() from None


def verify_gemini(key):
    result = _request(GEMINI_URL, key)
    if "generateContent" not in result.get("supportedGenerationMethods", []):
        raise PublicGoogleUnavailable()
    return {"model": GEMINI_MODEL, "metadata_check": "verified"}


def generate_json(key, instruction, inputs, *, tokens):
    payload = {
        "systemInstruction": {"parts": [{"text": instruction}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(inputs, ensure_ascii=True)}]}],
        "generationConfig": {
            "responseMimeType": "application/json", "maxOutputTokens": tokens,
            "candidateCount": 1, "thinkingConfig": {"thinkingLevel": "minimal"},
        },
    }
    packet = _request(GEMINI_URL + ":generateContent", key, payload=payload)
    try:
        candidates = packet["candidates"]
        candidate, = candidates
        if candidate["finishReason"] != "STOP":
            raise PublicGoogleUnavailable()
        content = candidate["content"]["parts"]
        part, = content
        text = part["text"]
        if part.get("thought") or not isinstance(text, str) or len(text) > 12000:
            raise PublicGoogleUnavailable()
        result = json.loads(text)
        if not isinstance(result, dict):
            raise PublicGoogleUnavailable()
        return result
    except (KeyError, TypeError, ValueError, AttributeError):
        raise PublicGoogleUnavailable() from None


def page_speed(key, target, strategy):
    packet = _request(PAGESPEED_URL, key, params={"url": target, "strategy": strategy, "category": "performance"},
                      limit=2 * 1024 * 1024, seconds=15)
    try:
        report = packet["lighthouseResult"]
        if report.get("runtimeError") or report["requestedUrl"] != target:
            raise PublicGoogleUnavailable()
        score = report["categories"]["performance"]["score"]
        if type(score) not in (int, float) or not 0 <= score <= 1:
            raise PublicGoogleUnavailable()
        return round(score * 100)
    except (KeyError, TypeError, ValueError, AttributeError):
        raise PublicGoogleUnavailable() from None
