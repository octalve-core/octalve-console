"""P0-ID: exact additive migration, local direct TLS connection only."""
import hashlib
import json
import os
import sys
from pathlib import Path
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations import AddField, AlterField, RunPython

sys.path.insert(0, str(Path(__file__).resolve().parent))
import production_webauthn_preflight as guard

TARGETS = {
    ("accounts", "0006_resource_identity"), ("billing", "0002_resource_identity"),
    ("orders", "0002_resource_identity"), ("domains", "0004_resource_identity"),
    ("payments", "0002_resource_identity"), ("services", "0002_resource_identity"),
    ("support", "0003_resource_identity"), ("wallet", "0002_resource_identity"),
}
TABLES = {
    "accounts_customuser": ("ACC", ("id",)),
    "billing_invoice": ("INV", ("id", "invoice_number", "client_id", "order_id")),
    "billing_quote": ("QTE", ("id", "quote_number", "client_id")),
    "orders_order": ("ORD", ("id", "order_number", "client_id")),
    "domains_domain": ("DOM", ("id", "domain_name", "client_id")),
    "services_service": ("SVC", ("id", "client_id")),
    "payments_transaction": ("TXN", ("id", "reference", "provider_reference", "client_id")),
    "support_supportticket": ("TKT", ("id", "ticket_number", "client_id")),
    "wallet_wallet": ("WLT", ("id", "user_id")),
}
BASELINE = (66, 120)
AFTER = (74, 120)


def refuse(message):
    raise SystemExit("P0-ID REFUSED: " + message)


def state(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(),current_user,(SELECT count(*) FROM public.django_migrations),(SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public')")
        database, role, count, tables = cur.fetchone()
        cur.execute("SELECT app,name FROM public.django_migrations")
        ledger = set(cur.fetchall())
    if database != guard.EXPECTED_DATABASE or role != guard.EXPECTED_ROLE or count != len(ledger):
        refuse("Wrong database/role or inconsistent ledger")
    if (count, tables) == BASELINE and not (ledger & TARGETS):
        return "before", ledger
    if (count, tables) == AFTER and TARGETS <= ledger:
        return "after", ledger
    refuse("Unexpected or partially migrated production schema")


def exact_plan(conn, stage):
    executor = MigrationExecutor(conn)
    executor.loader.check_consistent_history(conn)
    graph = set(executor.loader.graph.nodes)
    actual = set(executor.loader.applied_migrations)
    if actual != (graph - TARGETS if stage == "before" else graph):
        refuse("Django graph differs from reviewed production ledger")
    for target in TARGETS:
        migration = executor.loader.disk_migrations[target]
        if not migration.atomic or any(type(op) not in (AddField, AlterField, RunPython) for op in migration.operations):
            refuse("Unexpected migration operations")
        for op in migration.operations:
            if type(op) in (AddField, AlterField) and op.name not in ("public_id", "public_reference"):
                refuse("Unapproved field change")
            if type(op) is RunPython and op.code.__name__ not in ("populate", "install_legacy_writer_defaults"):
                refuse("Unapproved data operation")
    plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    if any(reverse for _, reverse in plan) or {(m.app_label,m.name) for m,_ in plan} != (TARGETS if stage=="before" else set()):
        refuse("Unexpected migration plan")
    return executor, plan


def original_digest(conn):
    """Preserve exact original identities; hash locally, never output records."""
    digest = hashlib.sha256()
    with conn.cursor() as cur:
        for table, (_, columns) in TABLES.items():
            cur.execute(f"SELECT {','.join(columns)} FROM public.{table} ORDER BY id")
            for row in cur:
                digest.update(json.dumps([table,*row],default=str,separators=(",",":")).encode()+b"\n")
        cur.execute("SELECT id,reference,invoice_id,client_id FROM public.payments_paymentintent ORDER BY id")
        for row in cur:
            digest.update(json.dumps(["payment_intent",*row],default=str,separators=(",",":")).encode()+b"\n")
    return digest.hexdigest()


def postflight(conn):
    with conn.cursor() as cur:
        for table,(kind,_) in TABLES.items():
            cur.execute(f"""SELECT count(*),count(public_id),count(DISTINCT public_id),
                count(public_reference),count(DISTINCT public_reference),
                count(*) FILTER (WHERE public_reference NOT LIKE %s OR public_id::text !~ %s)
                FROM public.{table}""", ("OC-"+kind+"-%",r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"))
            n,a,b,c,d,bad=cur.fetchone()
            if not (n==a==b==c==d and bad==0):
                refuse("Invalid resource identities in "+table)
            cur.execute("SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=%s AND column_name IN ('public_id','public_reference')",(table,))
            fields=cur.fetchall()
            if len(fields)!=2 or any(nullable!="NO" or not default for _,nullable,default in fields):
                refuse("Missing rolling-release defaults or NOT NULL constraint")
            cur.execute("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid=to_regclass(%s) AND contype='u'",("public."+table,))
            unique={r[0] for r in cur.fetchall()}
            if not all(any("("+col+")" in c for c in unique) for col in ("public_id","public_reference")):
                refuse("Missing uniqueness constraint in "+table)
    print("POSTFLIGHT PASS: all nine resource tables have unique, non-null identities and compatible defaults.")


def main():
    if len(sys.argv)!=2 or sys.argv[1] not in ("plan","apply"):
        refuse("Specify plan or apply")
    guard.runtime_guard()
    raw=guard.checked_url()
    import django
    django.setup()
    if connection.vendor!="postgresql" or connection.settings_dict.get("HOST")!=guard.EXPECTED_HOST:
        refuse("Wrong Django production connection")
    with guard._direct_connection(raw) as direct:
        prior,ledger=state(direct)
        exact_plan(connection,prior)
        if prior=="after":
            postflight(direct)
            print("Already applied; no changes")
            return
    print("PREFLIGHT PASS: exact 66 migrations/120 tables; eight additive identity migrations.")
    print("BASELINE LEDGER SHA256:",guard.ledger_digest(ledger))
    if sys.argv[1]=="plan":
        return
    guard.verify_backup_and_restore()
    if os.environ.get("OCTALVE_WEBAUTHN_SOURCE_APPROVED")!="true" or os.environ.get("OCTALVE_WEBAUTHN_LEDGER_SHA256")!=guard.ledger_digest(ledger):
        refuse("Approved source or verified restored baseline missing")
    guard._close_django_connections()
    if input("Type APPLY OCTALVE IDENTITY TO PRODUCTION: ")!="APPLY OCTALVE IDENTITY TO PRODUCTION":
        refuse("Explicit operator confirmation missing")
    guard.verify_backup_and_restore()
    with transaction.atomic():
        with connection.cursor() as cur:
            if not connection.connection.pgconn.ssl_in_use:
                refuse("Connection is not TLS")
            cur.execute("SELECT pg_try_advisory_xact_lock(hashtext('octalve_identity_release'))")
            if not cur.fetchone()[0]:
                refuse("Another release owns migration lock")
            cur.execute("SET LOCAL lock_timeout='10s'")
            # Consistent, fixed table order blocks old writers only for this transaction.
            for table in sorted([*TABLES,"payments_paymentintent"]):
                cur.execute(f"LOCK TABLE public.{table} IN ACCESS EXCLUSIVE MODE")
        phase,now=state(connection)
        if phase!="before" or now!=ledger:
            refuse("Production changed after preflight")
        executor,plan=exact_plan(connection,phase)
        before=original_digest(connection)
        executor.migrate(executor.loader.graph.leaf_nodes(),plan=plan)
        if state(connection)!=("after",ledger|TARGETS):
            refuse("Ledger mismatch")
        if original_digest(connection)!=before:
            refuse("Original identifiers changed; rolling back")
        postflight(connection)
    guard._close_django_connections()
    with guard._direct_connection(raw) as direct:
        if state(direct)!=("after",ledger|TARGETS):
            refuse("Independent postflight ledger mismatch")
        postflight(direct)
    print("SUCCESS: 74 migrations/120 tables; existing statutory and gateway references preserved.")

if __name__=="__main__":
    main()
