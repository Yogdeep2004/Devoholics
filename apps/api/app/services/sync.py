from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collectors.github import GitHubClient, NotFound
from app.models import FeedEvent, MetricSnapshot, Release, Repository, Technology

log = structlog.get_logger()


def sync_repository(db: Session, gh: GitHubClient, repo: Repository, tech: Technology) -> bool:
    """Refresh one repo: update stats, append snapshot, detect new release. Returns False if missing."""
    full = repo.repository_url.removeprefix("https://github.com/")
    try:
        d = gh.repo(full)
    except NotFound:
        log.warning("repo_not_found", repo=full)
        return False
    now = datetime.now(timezone.utc)
    repo.external_id, repo.repository_url = d.external_id, d.url
    repo.stars, repo.forks, repo.open_issues = d.stars, d.forks, d.open_issues
    repo.last_commit_at, repo.last_synced_at = d.last_commit_at, now
    tech.license = tech.license or d.license
    tech.description = tech.description or d.description
    tech.official_url = tech.official_url or d.homepage
    _upsert_daily_snapshot(db, repo.id, now, d.stars, d.forks, d.open_issues, d.contributors)
    rel = gh.latest_release(full)
    if rel and not db.scalar(select(Release.id).where(Release.repository_id == repo.id,
                                                      Release.version == rel.version)):
        first = db.scalar(select(Release.id).where(Release.repository_id == repo.id)) is None
        db.add(Release(repository_id=repo.id, version=rel.version, release_url=rel.url,
                       published_at=rel.published_at))
        if not first:  # don't flood the feed with a backfilled "new release" on first sync
            db.add(FeedEvent(technology_id=tech.id, event_type="new_release",
                             event_title=f"{tech.name} {rel.version} released", source_url=rel.url,
                             detected_at=now, event_metadata={"version": rel.version}))
    db.commit()
    return True


def _upsert_daily_snapshot(db: Session, repo_id: int, now: datetime, stars, forks, issues, contributors) -> None:
    """At most one snapshot per repo per UTC day: re-syncing refreshes today's point instead of adding noise."""
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    snap = db.scalar(select(MetricSnapshot).where(MetricSnapshot.repository_id == repo_id,
                                                  MetricSnapshot.recorded_at >= day_start))
    if snap:
        snap.stars, snap.forks, snap.open_issues, snap.contributors, snap.recorded_at = (
            stars, forks, issues, contributors, now)
    else:
        db.add(MetricSnapshot(repository_id=repo_id, stars=stars, forks=forks, open_issues=issues,
                              contributors=contributors, recorded_at=now))
