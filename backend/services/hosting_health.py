"""Bounded, independent public and origin TLS observations.

No HTTP requests, redirects, user-provided target, private IP, certificate
verification bypass or assumption that TLS implies website publication.
"""
import socket
import ssl
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone as utc_timezone

import certifi
from django.utils import timezone
from providers.pinned_egress import approved_origin,public_ip
from .resource_protocol import ResourceRefused,domain_name

def tls_probe(host,ip):
    host=domain_name(host)
    ip=public_ip(ip)
    ctx=ssl.create_default_context(cafile=certifi.where())
    ctx.minimum_version=ssl.TLSVersion.TLSv1_2
    try:
        with socket.create_connection((ip,443),timeout=3) as tcp:
            with ctx.wrap_socket(tcp,server_hostname=host) as tls:
                certificate=tls.getpeercert()
                expiry=datetime.fromtimestamp(ssl.cert_time_to_seconds(certificate["notAfter"]),tz=utc_timezone.utc)
                if expiry<=timezone.now():
                    raise ResourceRefused("TLS certificate expired.")
                return expiry.isoformat()
    except (OSError,ValueError,TypeError,KeyError,ssl.SSLError):
        raise ResourceRefused("TLS could not be confirmed.") from None

def _resolved(host):
    try:
        rows=socket.getaddrinfo(host,443,type=socket.SOCK_STREAM,proto=socket.IPPROTO_TCP)
        addresses=sorted({public_ip(row[4][0]) for row in rows})
    except (OSError,ValueError,TypeError):
        raise ResourceRefused("Public DNS could not be confirmed.") from None
    if not 1<=len(addresses)<=4:
        raise ResourceRefused("Public DNS inventory unavailable.")
    return addresses

def ssl_readiness(protocol):
    host=domain_name(protocol.domain)
    _,_,origin,_=approved_origin(protocol.origin+"/",bound_origin=protocol.binding)
    result={"origin_tls":"unverified","public_tls":"unverified","public_expires_at":None,"origin_expires_at":None,
            "website_content_verified":False,"public_propagation_verified":False}
    try:
        result["origin_expires_at"]=tls_probe(host,origin)
        result["origin_tls"]="valid"
    except (ResourceRefused,ValueError):
        pass
    try:
        addresses=_resolved(host)
        with ThreadPoolExecutor(max_workers=4) as pool:
            expiry=list(pool.map(lambda ip:tls_probe(host,ip),addresses))
        if _resolved(host)!=addresses:
            raise ResourceRefused("Public addresses changed.")
        result["public_expires_at"]=min(expiry)
        result["public_tls"]="valid"
    except (ResourceRefused,ValueError):
        pass
    return result
