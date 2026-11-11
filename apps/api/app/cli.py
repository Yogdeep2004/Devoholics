"""python -m app.cli seed|sync  (idempotent; safe to cron)."""
import sys

import httpx
import structlog
from sqlalchemy import select

from app.collectors.github import GitHubClient, RateLimited
from app.core.config import settings
from app.core.logging import configure_logging
from app.db import SessionLocal
from app.models import Repository, Technology, User
from app.seed import PACKAGES
from app.services import ingest
from app.services.seed import seed_catalog
from app.services.sync import sync_repository

log = structlog.get_logger()


def seed() -> None:
    with SessionLocal() as db:
        n = seed_catalog(db)
        log.info("seeded", technologies=n)


def sync() -> None:
    gh = GitHubClient(settings.github_token)
    ok = missing = 0
    with SessionLocal() as db:
        for repo in db.scalars(select(Repository).where(Repository.source_platform == "github")).all():
            try:
                if sync_repository(db, gh, repo, repo.technology):
                    ok += 1
                else:
                    missing += 1
            except RateLimited as e:
                log.error("rate_limited", reset_at=e.reset_at); break
            except Exception as e:  # one bad repo must not abort the run
                db.rollback(); missing += 1
                log.error("sync_failed", repo=repo.repository_url, error=str(e)[:200])
    log.info("synced", ok=ok, not_found=missing)


def _http():
    return httpx.Client(timeout=30, follow_redirects=True, headers={"User-Agent": "devoholics/0.1"})


def packages() -> None:
    ok = 0
    with SessionLocal() as db, _http() as c:
        for slug, reg, name in PACKAGES:
            t = db.scalar(select(Technology).where(Technology.slug == slug))
            if t and ingest.sync_package(db, t, reg, name, c):
                ok += 1
            else:
                log.warning("package_skipped", slug=slug, registry=reg, name=name)
    log.info("packages_synced", ok=ok, total=len(PACKAGES))


def events() -> None:
    from app.intelligence import events as ev
    with SessionLocal() as db:
        log.info("events", releases=ev.backfill_recent_releases(db), warnings=ev.maintenance_warnings(db))


def discover_new() -> None:
    from app.services.discover import discover
    with SessionLocal() as db:
        log.info("discover", new=discover(db, GitHubClient(settings.github_token)))


def usecases() -> None:
    from app.ai.provider import get_llm
    from app.services.usecases import generate_use_cases
    with SessionLocal() as db:
        log.info("usecases", written=generate_use_cases(db, get_llm()))


def blueprints() -> None:
    """Upsert curated blueprints. Each graph must pass the real validator or seeding fails loudly."""
    from datetime import datetime, timezone

    from app.architecture.schema import Graph
    from app.architecture.validation import normalize_graph, validate_graph
    from app.blueprints_seed import BLUEPRINTS
    from app.models import Blueprint, BlueprintVersion, User

    with SessionLocal() as db:
        if not db.get(User, "system"):
            db.add(User(id="system", email="blueprints@devoholics.local", username="devoholics")); db.flush()
        for b in BLUEPRINTS:
            g = Graph.model_validate({"nodes": [dict(id=n["id"], kind="component", technology=n["technology"],
                                                     position={"x": n["x"], "y": n["y"]},
                                                     data=dict(label=n["label"], layer=n["layer"], component_type=n["ctype"]))
                                                for n in b["nodes"]],
                                      "edges": [dict(e) for e in b["edges"]]})
            g = normalize_graph(db, g)
            rep = validate_graph(db, g)
            if rep.errors:
                raise SystemExit(f"{b['slug']}: " + "; ".join(i.message for i in rep.errors))
            row = db.scalar(select(Blueprint).where(Blueprint.slug == b["slug"]))
            notes = [{"from": f, "to": t, "explanation": x} for f, t, x in b["integration"]]
            if row is None:
                row = Blueprint(slug=b["slug"], author_id="system", title=b["title"], description=b["description"],
                                difficulty=b["difficulty"], curated=True, status="published", version=0,
                                published_at=datetime.now(timezone.utc))
                db.add(row)
            row.data_flows, row.integration_notes = b["data_flows"], notes
            row.infrastructure_notes, row.known_limitations = b["infra"], b["limits"]
            row.title, row.description, row.difficulty = b["title"], b["description"], b["difficulty"]
            latest = row.versions[-1] if row.versions else None
            if latest is not None and normalize_graph(db, Graph.model_validate(latest.graph_json)).model_dump() == g.model_dump():
                if latest.graph_json != g.model_dump():
                    latest.graph_json = g.model_dump()  # metadata-only fix (types derived); not a content change
            elif latest is None or latest.graph_json != g.model_dump():
                row.version += 1
                row.versions.append(BlueprintVersion(version=row.version, graph_json=g.model_dump(),
                                                     changelog="Curated by DEVOHOLICS"))
            log.info("blueprint", slug=b["slug"], warnings=len([i for i in rep.issues if i.level == "warning"]),
                     version=row.version)
        db.commit()


def make_admin() -> None:
    email = sys.argv[2]
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == email))
        if not u:
            raise SystemExit(f"no user with email {email}; sign in once first")
        u.is_admin = True; db.commit(); log.info("admin_granted", email=email)


def security_check() -> None:
    """Fail (exit 1) if any table in `public` lacks row-level security. Run after migrations and in CI."""
    from app.db import engine
    from app.security import find_exposed_writable, find_unprotected
    if engine.dialect.name != "postgresql":
        log.info("security_check_skipped", reason="not postgres"); return
    with engine.connect() as conn:
        bad = find_unprotected(conn)
        writable = find_exposed_writable(conn, bad)
    if bad:
        log.error("tables_without_rls", tables=bad, writable_by_api_roles=writable)
        raise SystemExit(f"Tables in public without RLS: {', '.join(bad)}")
    log.info("security_check_ok")


def refresh() -> None:
    """Everything a daily cron needs, in order. Each step is idempotent."""
    for step in (sync, discover_new, usecases, packages, models, events):
        try:
            step()
        except Exception as e:  # keep going; one failing source must not block the rest
            log.error("refresh_step_failed", step=step.__name__, error=str(e)[:200])


def models() -> None:
    with SessionLocal() as db, _http() as c:
        log.info("hf_ingested", count=ingest.ingest_hf_models(db, c))


def mcp() -> None:
    with SessionLocal() as db, _http() as c:
        log.info("mcp_ingested_new", count=ingest.ingest_mcp(db, c))


if __name__ == "__main__":
    configure_logging(settings.log_level)
    {"seed": seed, "sync": sync, "packages": packages, "models": models, "mcp": mcp, "events": events, "refresh": refresh, "blueprints": blueprints, "security-check": security_check, "discover": discover_new, "usecases": usecases, "make-admin": make_admin}[sys.argv[1]]()
