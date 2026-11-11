import re
from pathlib import Path

from app.security import find_exposed_writable, find_unprotected


class FakeConn:
    """Stands in for a Postgres connection: returns canned rows per query."""
    def __init__(self, unprotected=(), writable=()):
        self.unprotected, self.writable, self.calls = unprotected, writable, []

    def execute(self, stmt, params=None):
        self.calls.append(params)
        return [(n,) for n in (self.writable if params else self.unprotected)]


def test_reports_tables_without_rls():
    assert find_unprotected(FakeConn(unprotected=["alembic_version"])) == ["alembic_version"]
    assert find_unprotected(FakeConn()) == []


def test_exposed_writable_only_checks_what_it_is_given():
    c = FakeConn(writable=["alembic_version"])
    assert find_exposed_writable(c, []) == [] and c.calls == []  # nothing to check, no query
    assert find_exposed_writable(c, ["alembic_version"]) == ["alembic_version"]
    assert c.calls == [{"names": ["alembic_version"]}]


def test_the_protecting_migration_enables_rls_and_revokes_client_roles():
    src = Path(__file__).parents[1].joinpath("migrations/versions/0008_protect_alembic_version.py").read_text()
    assert "ENABLE ROW LEVEL SECURITY" in src and "public.alembic_version" in src
    assert re.search(r"REVOKE ALL ON TABLE public\.alembic_version FROM %I", src)
    assert "'anon'" in src and "'authenticated'" in src
    assert "CREATE POLICY" not in src.upper()  # never add a permissive policy just to silence the lint
    assert "pg_roles" in src  # safe on plain Postgres without Supabase roles
