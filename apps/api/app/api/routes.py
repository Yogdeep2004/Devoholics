from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import decode_token
from app.db import get_db
from app.intelligence import dimensions as dim
from app.intelligence.growth import growth
from app.intelligence.ranking import score
from app.models import (
    Category,
    FeedEvent,
    MetricSnapshot,
    Package,
    Release,
    Repository,
    Technology,
    TechnologyRelationship,
    UserFollow,
    UserInterest,
)

router = APIRouter(prefix="/api/v1")


def _tech_summary(t: Technology) -> dict:
    repo = t.repositories[0] if t.repositories else None
    return {"slug": t.slug, "name": t.name, "description": t.description, "category": t.category.slug,
            "license": t.license, "official_url": t.official_url,
            "stars": repo.stars if repo else None, "forks": repo.forks if repo else None,
            "repository_url": repo.repository_url if repo else None,
            "freshness": dim.freshness(repo.last_synced_at if repo else None)}


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    rows = db.execute(select(Category, func.count(Technology.id)).outerjoin(Technology)
                      .group_by(Category.id).order_by(Category.name)).all()
    return [{"slug": c.slug, "name": c.name, "technology_count": n} for c, n in rows]


@router.get("/technologies")
def technologies(q: str | None = None, category: str | None = None,
                 sort: str = Query("stars", pattern="^(stars|name)$"),
                 limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                 db: Session = Depends(get_db)):
    stmt = select(Technology).join(Category)
    if category:
        stmt = stmt.where(Category.slug == category)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Technology.name).like(like), func.lower(Technology.description).like(like)))
    if sort == "stars":
        stmt = stmt.outerjoin(Repository).order_by(Repository.stars.desc().nulls_last())
    else:
        stmt = stmt.order_by(Technology.name)
    return [_tech_summary(t) for t in db.scalars(stmt.limit(limit).offset(offset)).unique()]


@router.get("/technologies/{slug}")
def technology(slug: str, db: Session = Depends(get_db)):
    t = db.scalar(select(Technology).where(Technology.slug == slug))
    if not t:
        raise HTTPException(404, "technology not found")
    repo = t.repositories[0] if t.repositories else None
    series, latest = [], None
    if repo:
        series = [(s.recorded_at, s.stars) for s in db.scalars(
            select(MetricSnapshot).where(MetricSnapshot.repository_id == repo.id).order_by(MetricSnapshot.recorded_at))]
        latest = db.scalar(select(Release).where(Release.repository_id == repo.id)
                           .order_by(Release.published_at.desc().nulls_last()))
        snap = db.scalar(select(MetricSnapshot).where(MetricSnapshot.repository_id == repo.id)
                         .order_by(MetricSnapshot.recorded_at.desc()))
    rels = db.scalars(select(TechnologyRelationship).where(TechnologyRelationship.source_technology_id == t.id)).all()
    return {**_tech_summary(t), "documentation_url": t.documentation_url,
            "packages": [{"registry": p.registry_name, "name": p.name, "version": p.latest_version, "published_at": p.latest_published_at,
                          "weekly_downloads": p.weekly_downloads, "dependencies": p.dependency_count, "url": p.package_url}
                         for p in db.scalars(select(Package).where(Package.technology_id == t.id))],
            "source_platform": repo.source_platform if repo else None,
            "platform_metadata": repo.platform_metadata if repo else None,
            "latest_release": {"version": latest.version, "url": latest.release_url,
                               "published_at": latest.published_at} if latest else None,
            "history": [{"recorded_at": ts, "stars": v} for ts, v in series],
            "dimensions": {
                "momentum": dim.momentum(series),
                "maintenance": dim.maintenance(repo.last_commit_at if repo else None,
                                               latest.published_at if latest else None,
                                               repo.open_issues if repo else None,
                                               snap.contributors if repo and snap else None),
                "ecosystem": dim.ecosystem(sum(r.verification_status == "verified" for r in rels), len(rels)),
                "readiness": dim.readiness(t.license, t.documentation_url, latest is not None)}}


def optional_user_id(authorization: str | None = Header(None)) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return decode_token(authorization[7:]).sub
    return None


WINDOWS = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}
TYPE_GROUPS = {"trending": ["trending"], "releases": ["new_release"], "warnings": ["maintenance_warning"]}


def _stars_gained(db: Session, repo_ids: list[int], days: int) -> dict[int, int | None]:
    series: dict[int, list] = {i: [] for i in repo_ids}
    for rid, ts, st in db.execute(select(MetricSnapshot.repository_id, MetricSnapshot.recorded_at, MetricSnapshot.stars)
                                  .where(MetricSnapshot.repository_id.in_(repo_ids))):
        series[rid].append((ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc), st))
    out = {}
    for rid, ser in series.items():
        g = growth(ser, days)
        out[rid] = g.absolute if g else None
    return out


@router.get("/feed")
def feed(event_type: str | None = None, window: str = Query("30d", pattern="^(24h|7d|30d|90d)$"),
         sort: str = Query("relevance", pattern="^(relevance|recency|growth)$"),
         limit: int = Query(50, ge=1, le=200), user_id: str | None = Depends(optional_user_id),
         db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=WINDOWS[window])
    stmt = select(FeedEvent, Technology).join(Technology).where(FeedEvent.detected_at >= since)
    if event_type:
        stmt = stmt.where(FeedEvent.event_type.in_(TYPE_GROUPS.get(event_type, [event_type])))
    rows = db.execute(stmt.order_by(FeedEvent.detected_at.desc()).limit(1000)).all()
    followed, interests = set(), set()
    if user_id:
        followed = set(db.scalars(select(UserFollow.technology_id).where(UserFollow.user_id == user_id)))
        interests = set(db.scalars(select(UserInterest.category_id).where(UserInterest.user_id == user_id)))
    repo_ids = [t.repositories[0].id for _, t in rows if t.repositories]
    gained = _stars_gained(db, list(set(repo_ids)), 7) if repo_ids else {}
    cards = []
    for e, t in rows:
        repo = t.repositories[0] if t.repositories else None
        sc, why = score(e.event_type, e.detected_at, t.id in followed, t.category_id in interests)
        cards.append({"id": e.id, "type": e.event_type, "title": e.event_title, "description": t.description,
                      "technology": {"slug": t.slug, "name": t.name, "category": t.category.slug},
                      "source": repo.source_platform if repo else None, "source_url": e.source_url,
                      "detected_at": e.detected_at, "metadata": e.event_metadata,
                      "metrics": {"stars": repo.stars if repo else None, "forks": repo.forks if repo else None,
                                  "stars_gained_7d": gained.get(repo.id) if repo else None},
                      "score": round(sc, 2), "reasons": why})
    key = {"relevance": lambda c: -c["score"], "recency": lambda c: str(c["detected_at"]) ,
           "growth": lambda c: -(c["metrics"]["stars_gained_7d"] or -1)}[sort]
    cards.sort(key=key, reverse=(sort == "recency"))
    return cards[:limit]


@router.get("/trending")
def trending(days: int = Query(7, ge=1, le=90), limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Stars gained over the window. Repos without enough snapshot history are excluded, not guessed."""
    repos = db.scalars(select(Repository).where(Repository.source_platform == "github")).all()
    gained = _stars_gained(db, [r.id for r in repos], days)
    ranked = sorted((r for r in repos if gained.get(r.id) is not None), key=lambda r: -gained[r.id])[:limit]
    return {"window_days": days, "items": [{**_tech_summary(r.technology), "stars_gained": gained[r.id]} for r in ranked],
            "note": None if ranked else "Not enough snapshot history yet; growth appears after 2+ syncs."}
