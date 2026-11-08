from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Repository, Technology
from app.seed import CATEGORIES, TECHS


def seed_catalog(db: Session) -> int:
    """Idempotent. A technology that already has a GitHub repository is never given a second one,
    even if GitHub renamed it (sync rewrites repository_url, so matching on URL would duplicate it)."""
    cats = {}
    for slug, name in CATEGORIES.items():
        c = db.scalar(select(Category).where(Category.slug == slug)) or Category(slug=slug, name=name)
        db.add(c); cats[slug] = c
    db.flush()
    for slug, name, cat, repo in TECHS:
        t = db.scalar(select(Technology).where(Technology.slug == slug))
        if not t:
            t = Technology(slug=slug, name=name, category_id=cats[cat].id)
            db.add(t); db.flush()
        has_repo = db.scalar(select(Repository.id).where(Repository.technology_id == t.id,
                                                         Repository.source_platform == "github"))
        if not has_repo:
            db.add(Repository(technology_id=t.id, source_platform="github", external_id=f"pending:{repo}",
                              repository_url=f"https://github.com/{repo}"))
    db.commit()
    return len(TECHS)
