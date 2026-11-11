"""Protect alembic_version from the Supabase Data API

alembic_version lives in `public`, which PostgREST exposes. It had RLS off, and Supabase's default
privileges give the `anon` and `authenticated` roles full DML on new public tables, so anyone holding the
(public) publishable key could read, rewrite or delete the migration state.

RLS with no policy denies those roles every row. Revoking the grants removes their access to the table
altogether (RLS does not govern TRUNCATE). Alembic connects as the table owner, which bypasses RLS, so
migrations keep working.

Revision ID: 0008
Revises: 0007
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY")
    # Plain Postgres (no Supabase roles) has no anon/authenticated: only revoke where the role exists.
    op.execute("""
        DO $$
        DECLARE r text;
        BEGIN
          FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
              EXECUTE format('REVOKE ALL ON TABLE public.alembic_version FROM %I', r);
            END IF;
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    # Deliberately a no-op: re-exposing the migration table would only reintroduce the vulnerability.
    pass
