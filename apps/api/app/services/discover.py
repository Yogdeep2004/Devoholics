"""Finds genuinely new repositories via GitHub's official Search API and adds them as technologies.

No guessing: every number is GitHub's. "Stars per day" is an average since the repository was created, and is labelled that way in the UI.
"""
import re
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collectors.github import GitHubClient, RepoData
from app.models import Category, FeedEvent, Repository, Technology
from app.services.sync import _upsert_daily_snapshot

log = structlog.get_logger()

# (theme, GitHub topic, our category slug)
THEMES = [("mcp", "mcp-server", "mcp"), ("agents", "ai-agents", "agent-frameworks"), ("llm", "llm", "llm-inference"),
          ("rag", "rag", "rag"), ("vector", "vector-database", "vector-databases"), ("devtools", "developer-tools", "dev-tools")]
MIN_STARS, PER_THEME = 30, 8


def _usable(r: RepoData) -> bool:
    name = r.full_name.split("/")[1].lower()
    return bool(r.description and not r.archived and not name.startswith("awesome") and "awesome-list" not in r.topics and r.created_at)


def _slug(full_name: str) -> str:
    return "gh-" + re.sub(r"[^a-z0-9]+", "-", full_name.lower()).strip("-")[:190]


def discover(db: Session, gh: GitHubClient, days: int = 60, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    since = (now - timedelta(days=days)).date().isoformat()
    seen: set[str] = set()
    added = 0
    for theme, topic, cat_slug in THEMES:
        cat = db.scalar(select(Category).where(Category.slug == cat_slug))
        if cat is None:
            continue
        hits = [h for h in gh.search(f"topic:{topic} created:>={since} stars:>={MIN_STARS}", per_page=PER_THEME * 3) if _usable(h)]
        for h in hits[:PER_THEME]:
            if h.external_id in seen:
                continue
            seen.add(h.external_id)
            repo = db.scalar(select(Repository).where(Repository.source_platform == "github", Repository.repository_url == h.url))
            if repo is None:
                t = Technology(slug=_slug(h.full_name), name=h.full_name.split("/")[1], category_id=cat.id, description=h.description,
                               official_url=h.homepage, license=h.license)
                db.add(t); db.flush()
                repo = Repository(technology_id=t.id, source_platform="github", external_id=h.external_id, repository_url=h.url)
                db.add(repo); db.flush()
                added += 1
            repo.stars, repo.forks, repo.open_issues, repo.last_commit_at = h.stars, h.forks, h.open_issues, h.last_commit_at
            repo.repo_created_at, repo.topics, repo.last_synced_at = h.created_at, h.topics, now
            _upsert_daily_snapshot(db, repo.id, now, h.stars, h.forks, h.open_issues, None)
            tech = repo.technology
            if not db.scalar(select(FeedEvent.id).where(FeedEvent.technology_id == tech.id, FeedEvent.event_type == "new_tool")):
                age = max(1, (now - h.created_at).days)
                db.add(FeedEvent(technology_id=tech.id, event_type="new_tool", event_title=f"{tech.name} launched {age}d ago with {h.stars:,} stars",
                                 source_url=h.url, detected_at=h.created_at, event_metadata={"stars": h.stars, "age_days": age, "theme": theme}))
        db.commit()
    log.info("discovered", new=added, themes=len(THEMES))
    return added
