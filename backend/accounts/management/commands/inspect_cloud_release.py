"""Read-only, redacted operational preflight. Never certifies external suppliers."""
import json
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.migrations.loader import MigrationLoader
from catalog.models import Plan

class Command(BaseCommand):
    help="Read-only Cloud release preflight. Never changes state or prints secrets."

    def add_arguments(self, parser):
        parser.add_argument("--database", default="default", help="Configured Django database alias")
        parser.add_argument("--json", action="store_true", help="Print one redacted JSON record")

    def handle(self, *args, **opts):
        alias=opts["database"]
        if alias not in connections:
            raise ValueError("Unknown database alias.")
        db=connections[alias]
        output={
            "schema_version":1,"read_only":True,"external_certified":False,
            "database_alias":alias,"database_vendor":db.vendor,
            "database_connection":"unverified","migration_parity":"unverified",
            "unpublished_public_hosting_plans":None,
            "payment_activation":"not_certified",
            "provider_execution":"not_certified",
            "immutable_recovery":"not_certified",
            "browser_810_case_acceptance":"not_certified",
        }
        try:
            with db.cursor() as cursor:
                cursor.execute("SELECT 1")
                if cursor.fetchone()[0] != 1:
                    raise ValueError("Unexpected database liveness result")
            output["database_connection"]="reachable"
            loader=MigrationLoader(db)
            plan=loader.graph.leaf_nodes()
            applied=loader.applied_migrations
            missing=set(loader.graph.nodes)-applied
            output["migration_parity"]="matched" if not missing else "pending"
            output["unapplied_migration_count"]=len(missing)
            output["migration_leaf_count"]=len(plan)
            output["unpublished_public_hosting_plans"]=Plan.objects.using(alias).filter(
                status="active",is_public=True,
                product__status="active",product__is_public=True,
                product__product_type__in=("shared_hosting","wordpress_hosting","vps"),
            ).exclude(published_versions__isnull=False).count()
        except Exception:
            output["database_connection"]="failed" if output["database_connection"]!="reachable" else "reachable"
            output["inspection_error"]="Read-only verification could not complete; details redacted."
        self.stdout.write(json.dumps(output,sort_keys=True))
