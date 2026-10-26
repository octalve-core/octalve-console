"""Pure DirectAdmin/WHM account-create wire contract — absolutely no I/O.

The caller must obtain the AccountCreationPlan from a settled paid order.
The external worker is NOT implemented or enabled here. This module creates
only a local API request specification, never invokes requests or logs secrets.
Vendor compatibility must be verified against an authorized server before
enabling any remote mutation.
"""
from dataclasses import dataclass, field
import re
import secrets
from provisioning.account_creation_plan import AccountCreationPlan, CreationPlanRefused

NAME = re.compile(r"^[a-z][a-z0-9]{3,7}$")
DOMAIN = re.compile(r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$")
PACKAGE = re.compile(r"^[A-Za-z0-9_.-]{1,80}$")
OWNER = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{1,31}$")


@dataclass(frozen=True)
class VendorCreateRequest:
    adapter_type: str
    method: str
    path: str
    query: dict = field(repr=False)
    form: dict = field(repr=False)
    contains_ephemeral_password: bool = False


def compile_account_create(plan, *, make_password=None):
    """Vendor POST/GET *description* only, with all authority already scoped.

    No provider host or API credential appears in the result. WHM API1
    documents GET createacct. We never include a password in its query and
    explicitly suppress showing an auto-generated password in its response.
    DirectAdmin legacy API documents POST CMD_API_ACCOUNT_USER; its mandatory
    password is an ephemeral backend-generated value held only in memory.
    """
    if (not isinstance(plan, AccountCreationPlan)
            or plan.task_id < 1 or plan.service_id < 1 or plan.provider_id < 1
            or not NAME.fullmatch(plan.username)
            or not DOMAIN.fullmatch(plan.domain)
            or not PACKAGE.fullmatch(plan.package)
            or not OWNER.fullmatch(plan.reseller_owner)
            or not isinstance(plan.email, str)
            or not 1 <= len(plan.email) <= 254 or "@" not in plan.email
            or any(ch in plan.email for ch in ("\n", "\r", "\x00"))
            or plan.adapter_type not in ("DirectAdminAdapter", "CpanelAdapter")):
        raise CreationPlanRefused("Paid provider account contract is invalid.")
    if plan.adapter_type == "DirectAdminAdapter":
        generate = make_password or (lambda: secrets.token_urlsafe(40))
        password = generate()
        if (not isinstance(password, str) or len(password) < 32 or len(password) > 120
                or any(ord(ch) < 33 or ord(ch) > 126 for ch in password)):
            raise CreationPlanRefused("A secure ephemeral account password is required.")
        fields = {
            "action": "create", "add": "Submit",
            "username": plan.username, "domain": plan.domain,
            "email": plan.email, "package": plan.package,
            "ip": "shared", "notify": "no",
            "passwd": password, "passwd2": password,
        }
        return VendorCreateRequest(
            plan.adapter_type, "POST", "/CMD_API_ACCOUNT_USER",
            {}, fields, contains_ephemeral_password=True)
    return VendorCreateRequest(
        plan.adapter_type, "GET", "/json-api/createacct",
        {"api.version": "1", "username": plan.username,
         "domain": plan.domain, "plan": plan.package,
         "contactemail": plan.email, "owner": plan.reseller_owner,
         "showpass": "n", "reseller": "0"}, {},
        contains_ephemeral_password=False)
