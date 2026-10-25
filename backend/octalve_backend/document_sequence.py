"""Serialize human-readable document number allocation on PostgreSQL.

The existing Order and Invoice numbering uses MAX + 1. PostgreSQL advisory
transaction locks prevent competing checkouts from choosing the same number.
No new schema, ledger rewrites or external sequence are introduced.
"""
from django.db import connection


def lock_document_sequence(kind: int) -> None:
    if connection.vendor != "postgresql":
        return  # Development-only SQLite; Production uses PostgreSQL.
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s, %s)", [64291, kind])
