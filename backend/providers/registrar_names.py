"""Reviewed standard generic TLDs using the ordinary registrant-contact contract.

Do not infer support for restricted, premium, IDN or country-code registries.
A live supplier quote and explicit retail publication are still mandatory.
"""
import re
from .cloudflare_int01 import CloudflareINT01Denied

STANDARD_TLDS=("com","net","org","info","biz","xyz","online","site","store","tech","website","space","club","shop","cloud")
PATTERN=re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.([a-z]{2,63})")

def require_standard_domain(value,adapter=None):
    if not isinstance(value,str) or len(value)>253 or value.startswith("xn--"):
        raise CloudflareINT01Denied()
    match=PATTERN.fullmatch(value)
    allowed=("com","net") if adapter=="cloudflare-registrar-live" else STANDARD_TLDS
    if not match or match[1] not in allowed:
        raise CloudflareINT01Denied()
    return value
