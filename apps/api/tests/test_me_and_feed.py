from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as m
from app.db import Base, get_db
from app.intelligence.ranking import score
from app.main import app


def setup():
    eng = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        c = m.Category(name="AI", slug="ai"); s.add(c); s.flush()
        for slug in ("a", "b"):
            t = m.Technology(name=slug.upper(), slug=slug, category_id=c.id); s.add(t); s.flush()
            s.add(m.FeedEvent(technology_id=t.id, event_type="new_release", event_title=f"{slug} 1.0",
                              detected_at=datetime.now(timezone.utc) - timedelta(days=3)))
        s.commit()
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = lambda: Session(eng)
    return TestClient(app), eng


def test_requires_auth():
    c, _ = setup()
    assert c.get("/api/v1/me").status_code == 401
    assert c.put("/api/v1/me/bookmarks/a", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_follow_boosts_feed_and_library():
    from app.core.auth import current_user
    c, eng = setup()
    with Session(eng) as s:
        s.add(m.User(id="u1", email="u@x.dev")); s.commit()
    app.dependency_overrides[current_user] = lambda: m.User(id="u1", email="u@x.dev")
    assert c.put("/api/v1/me/follows/b").json() == {"following": True}
    assert c.put("/api/v1/me/bookmarks/nope").status_code == 404
    assert c.put("/api/v1/me/interests", json={"categories": ["zzz"]}).status_code == 422
    lib = c.get("/api/v1/me/library").json()
    assert [t["slug"] for t in lib["follows"]] == ["b"] and lib["bookmarks"] == []
    assert c.delete("/api/v1/me/follows/b").json() == {"following": False}


def test_ranking_is_explainable():
    now = datetime.now(timezone.utc)
    a, why = score("new_release", now, True, False, now)
    b, _ = score("new_release", now, False, False, now)
    assert a - b == 50 and "you follow this technology" in why
    old, _ = score("new_release", now - timedelta(days=30), False, False, now)
    assert old < b
