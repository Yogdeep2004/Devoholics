"""Guards for the Supabase Data API. Every table in `public` is reachable through PostgREST, so each needs RLS."""
from sqlalchemy import text

UNPROTECTED_SQL = text("""
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    ORDER BY c.relname
""")

# Roles the Data API uses for clients. A table that grants them anything but has no RLS is wide open.
EXPOSED_WRITE_SQL = text("""
    SELECT DISTINCT table_name FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') AND table_name = ANY(:names)
    ORDER BY table_name
""")


def find_unprotected(conn) -> list[str]:
    """Names of public tables with row-level security switched off."""
    return [r[0] for r in conn.execute(UNPROTECTED_SQL)]


def find_exposed_writable(conn, names: list[str]) -> list[str]:
    """Of the unprotected tables, those that anon/authenticated can also write to (the severe case)."""
    if not names:
        return []
    return [r[0] for r in conn.execute(EXPOSED_WRITE_SQL, {"names": names})]
