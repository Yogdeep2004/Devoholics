"""python -m app.cli seed|sync  (idempotent; safe to cron)."""
import sys

import httpx
import structlog
from sqlalchemy import select

from app.collectors.github import GitHubClient, RateLimited
from app.core.config import settings
from app.core.logging import configure_logging
from app.db import SessionLocal
from app.models import Category, Repository, Technology
from app.seed import CATEGORIES, PACKAGES, TECHS
from app.services import ingest
from app.services.sync import sync_repository

log = structlog.get_logger()


def seed() -> None:
    with SessionLocal() as db:
        cats = {}
        for slug, name in CATEGORIES.items():
            c = db.scalar(select(Category).where(Category.slug == slug)) or Category(slug=slug, name=name)
            db.add(c); cats[slug] = c
        db.flush()
        for slug, name, cat, repo in TECHS:
            t = db.scalar(select(Technology).where(Technology.slug == slug))
            if not t:
                t = Technology(slug=slug, name=name, category_id=cats[cat].id); db.add(t); db.flush()
            url = f"https://github.com/{repo}"
            if not db.scalar(select(Repository).where(Repository.repository_url == url)):
                db.add(Repository(technology_id=t.id, source_platform="github",
                                  external_id=f"pending:{repo}", repository_url=url))
        db.commit()
        log.info("seeded", technologies=len(TECHS))


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


def refresh() -> None:
    """Everything a daily cron needs, in order. Each step is idempotent."""
    for step in (sync, packages, models, events):
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
    {"seed": seed, "sync": sync, "packages": packages, "models": models, "mcp": mcp, "events": events, "refresh": refresh}[sys.argv[1]]()
