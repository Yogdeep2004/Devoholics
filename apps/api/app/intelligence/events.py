"""Derived feed events. Idempotent; every event cites a source and is explainable."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FeedEvent, Release, Repository

STALE_DAYS = 180
MIN_STARS = 1000  # only warn about projects people actually depend on


def backfill_recent_releases(db: Session, days: int = 90) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    n = 0
    for rel, repo in db.execute(select(Release, Repository).join(Repository).where(Release.published_at >= cutoff)):
        url = rel.release_url
        if db.scalar(select(FeedEvent.id).where(FeedEvent.technology_id == repo.technology_id,
                                               FeedEvent.event_type == "new_release", FeedEvent.source_url == url)):
            continue
        db.add(FeedEvent(technology_id=repo.technology_id, event_type="new_release",
                         event_title=f"{repo.technology.name} {rel.version} released", source_url=url,
                         detected_at=rel.published_at, event_metadata={"version": rel.version, "source": "github_release"}))
        n += 1
    db.commit()
    return n


def maintenance_warnings(db: Session) -> int:
    """Warn only on evidence: archived repo is not tracked yet, so use last push age."""
    now, n = datetime.now(timezone.utc), 0
    for repo in db.scalars(select(Repository).where(Repository.source_platform == "github",
                                                    Repository.last_commit_at.is_not(None),
                                                    Repository.stars >= MIN_STARS)):
        lc = repo.last_commit_at if repo.last_commit_at.tzinfo else repo.last_commit_at.replace(tzinfo=timezone.utc)
        age = (now - lc).days
        if age < STALE_DAYS:
            continue
        title = f"{repo.technology.name}: no pushes in {age // 30} months"
        if db.scalar(select(FeedEvent.id).where(FeedEvent.technology_id == repo.technology_id,
                                               FeedEvent.event_type == "maintenance_warning")):
            continue
        db.add(FeedEvent(technology_id=repo.technology_id, event_type="maintenance_warning",
                         event_title=title, source_url=repo.repository_url, detected_at=now,
                         event_metadata={"days_since_push": age}))
        n += 1
    db.commit()
    return n
