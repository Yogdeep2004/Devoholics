import re
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collectors import registries as R
from app.models import Category, Package, Repository, Technology
from app.services.sync import _upsert_daily_snapshot


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:190]


def _cat(db: Session, slug: str, name: str) -> Category:
    return db.scalar(select(Category).where(Category.slug == slug)) or _new(db, Category(slug=slug, name=name))


def _new(db, obj):
    db.add(obj); db.flush(); return obj


def sync_package(db: Session, tech: Technology, registry: str, name: str, c: httpx.Client) -> bool:
    d = (R.npm_package if registry == "npm" else R.pypi_package)(name, c)
    if d is None:
        return False
    p = db.scalar(select(Package).where(Package.registry_name == registry, Package.name == name)) \
        or _new(db, Package(technology_id=tech.id, registry_name=registry, name=name))
    p.latest_version, p.latest_published_at = d.version, d.published_at
    p.weekly_downloads, p.dependency_count, p.package_url = d.weekly_downloads, d.dependency_count, d.url
    p.last_synced_at = datetime.now(timezone.utc)
    db.commit()
    return True


def ingest_hf_models(db: Session, c: httpx.Client, limit: int = 40) -> int:
    cat = _cat(db, "models", "LLMs & Models")
    n = 0
    for m in R.hf_top_models(c, limit):
        t = db.scalar(select(Technology).where(Technology.slug == "hf-" + _slug(m.id))) or _new(
            db, Technology(slug="hf-" + _slug(m.id), name=m.id, category_id=cat.id,
                           description=f"Hugging Face model ({m.pipeline_tag or 'unspecified task'})"))
        t.license = t.license or m.license
        t.official_url = t.official_url or m.url
        repo = db.scalar(select(Repository).where(Repository.source_platform == "huggingface",
                                                  Repository.external_id == m.id)) or _new(
            db, Repository(technology_id=t.id, source_platform="huggingface", external_id=m.id, repository_url=m.url))
        now = datetime.now(timezone.utc)
        repo.stars, repo.last_commit_at, repo.last_synced_at = m.likes, m.last_modified, now  # stars == likes
        repo.platform_metadata = {"downloads": m.downloads, "pipeline_tag": m.pipeline_tag, "stars_means": "likes"}
        _upsert_daily_snapshot(db, repo.id, now, m.likes, None, None, None)
        n += 1
    db.commit()
    return n


def ingest_mcp(db: Session, c: httpx.Client, cap: int = 120) -> int:
    """Registry servers with a GitHub repo become technologies; GitHub sync later adds the stats."""
    cat = _cat(db, "mcp", "MCP Ecosystem")
    n = 0
    for s in R.mcp_servers(c):
        if n >= cap:
            break
        if not s.github_repo:
            continue
        url = f"https://github.com/{s.github_repo}"
        repo = db.scalar(select(Repository).where(Repository.repository_url == url))
        info = {"mcp_registry": {"name": s.name, "version": s.version, "source": s.registry_url}}
        if repo:  # already tracked (e.g. curated); just attach registry evidence
            repo.platform_metadata = {**(repo.platform_metadata or {}), **info}
            continue
        slug = "mcp-" + _slug(s.name)
        t = db.scalar(select(Technology).where(Technology.slug == slug)) or _new(
            db, Technology(slug=slug, name=s.title or s.name, category_id=cat.id, description=s.description))
        db.add(Repository(technology_id=t.id, source_platform="github", external_id=f"pending:{s.github_repo}",
                          repository_url=url, platform_metadata=info))
        n += 1
    db.commit()
    return n
