"""Public DNS delegation observations, independent of the hosting/control-plane API.

Only fixed HTTPS recursive resolvers are queried. Agreement is observational
evidence, not a grant of DNS write permission or direct authoritative proof.
"""
import json
import re
from concurrent.futures import ThreadPoolExecutor
import requests
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.response import Response
from accounts.security_throttle import _spend
from providers.connection_vault import VaultUnavailable
from providers.cloudflare_int01 import CloudflareINT01Denied
from .models import Domain, DomainDNSBinding
from .dns_readonly import (
    _admin, _customer, _binding_matches_domain, _continued_dns_only_proof,
    _conn, _vault_read_ready, CONSENT_VERSION, NO_CACHE,
)

RESOLVERS=("https://dns.google/resolve","https://cloudflare-dns.com/dns-query")
LABEL=re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")


class DelegationUnavailable(ValueError):
    pass


def hostname(value):
    if not isinstance(value,str) or not 3<=len(value)<=254:
        raise DelegationUnavailable()
    value=value.removesuffix(".").lower()
    if len(value)>253 or "." not in value or not all(LABEL.fullmatch(x) for x in value.split(".")):
        raise DelegationUnavailable()
    return value


def _parse(packet,domain):
    if (not isinstance(packet,dict) or type(packet.get("Status")) is not int
            or packet["Status"]!=0 or packet.get("TC") is not False
            or packet.get("CD") is not False):
        raise DelegationUnavailable()
    question=packet.get("Question")
    if (not isinstance(question,list) or len(question)!=1 or not isinstance(question[0],dict)
            or hostname(question[0].get("name"))!=domain or question[0].get("type")!=2):
        raise DelegationUnavailable()
    answers=packet.get("Answer")
    if not isinstance(answers,list) or not 1<=len(answers)<=32:
        raise DelegationUnavailable()
    result=[]
    for answer in answers:
        if (not isinstance(answer,dict) or type(answer.get("type")) is not int
                or answer["type"] not in (2,46) or hostname(answer.get("name"))!=domain):
            raise DelegationUnavailable()
        if answer["type"]==2:
            result.append(hostname(answer.get("data")))
    if not 1<=len(result)<=16 or len(result)!=len(set(result)):
        raise DelegationUnavailable()
    return sorted(result)


def _query(endpoint,domain):
    if endpoint not in RESOLVERS:
        raise DelegationUnavailable()
    domain=hostname(domain)
    session=requests.Session()
    session.trust_env=False
    try:
        params={"name":domain,"type":"NS","cd":"false"}
        if endpoint==RESOLVERS[0]:
            params["edns_client_subnet"]="0.0.0.0/0"
        with session.get(endpoint,params=params,headers={"Accept":"application/dns-json"},
                         timeout=(2,4),allow_redirects=False,verify=True,stream=True) as reply:
            if reply.status_code!=200:
                raise DelegationUnavailable()
            raw=bytearray()
            for chunk in reply.iter_content(4096):
                raw.extend(chunk)
                if len(raw)>32768:
                    raise DelegationUnavailable()
            def unique(pairs):
                result={}
                for key,value in pairs:
                    if key in result:
                        raise DelegationUnavailable()
                    result[key]=value
                return result
            return _parse(json.loads(raw,object_pairs_hook=unique),domain)
    except (requests.RequestException,ValueError,TypeError,UnicodeError):
        raise DelegationUnavailable() from None
    finally:
        session.close()


def observe(domain):
    domain=hostname(domain)
    with ThreadPoolExecutor(max_workers=2) as pool:
        a,b=[pool.submit(_query,endpoint,domain) for endpoint in RESOLVERS]
        first,second=a.result(),b.result()
    if first!=second:
        return {"state":"inconsistent","nameservers":[]}
    return {"state":"observed","nameservers":first}


def _snapshot(domain):
    binding=DomainDNSBinding.objects.select_related("connection").filter(domain=domain).first()
    if (not binding or binding.state!=DomainDNSBinding.State.ACTIVE
            or not binding.consented_at or not binding.approved_at
            or binding.consent_version!=CONSENT_VERSION or not _binding_matches_domain(binding,domain)):
        return None,None
    _vault_read_ready()
    snapshot=_conn(binding.connection,binding.credential_version).dns_live_inventory(binding.zone_id,binding.zone_name)
    if not _continued_dns_only_proof(domain,snapshot):
        return None,None
    return binding,sorted(hostname(x) for x in snapshot["nameservers"])


def check(request,domain):
    if request.user.role=="client":
        _customer(request,domain)
    else:
        _admin(request)
    if not domain.is_active or domain.status not in ("active","dns_only"):
        raise PermissionDenied("Domain delegation check unavailable.")
    if _spend("dns:public_delegation",f"{request.user.pk}:{domain.pk}",4,60):
        raise Throttled(wait=60)
    try:
        result=observe(domain.domain_name)
    except DelegationUnavailable:
        result={"state":"unavailable","nameservers":[]}
    binding=None
    expected=None
    try:
        binding,expected=_snapshot(domain)
    except (CloudflareINT01Denied,VaultUnavailable,DelegationUnavailable,DatabaseError):
        pass
    current=Domain.objects.get(pk=domain.pk)
    if (current.client_id!=domain.client_id or current.domain_name!=domain.domain_name
            or not current.is_active or current.status!=domain.status):
        raise PermissionDenied("Domain authority changed.")
    if binding:
        fresh=DomainDNSBinding.objects.select_related("connection").get(pk=binding.pk)
        if (fresh.updated_at!=binding.updated_at or fresh.state!=DomainDNSBinding.State.ACTIVE
                or not _binding_matches_domain(fresh,current)):
            expected=None
    comparison=("not_connected" if expected is None else "unavailable" if result["state"]!="observed"
                else "matches" if expected==result["nameservers"] else "differs")
    return Response({"domain":current.domain_name,**result,"configured_zone_comparison":comparison,
                     "checked_at":timezone.now().isoformat(),"write_authorized":False,
                     "public_propagation_verified":False},headers=NO_CACHE)
