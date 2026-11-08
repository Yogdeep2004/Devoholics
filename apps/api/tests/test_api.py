from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as m
from app.db import Base, get_db
from app.main import app


def _client():
    eng = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        c = m.Category(name="Vector DBs", slug="vector"); s.add(c); s.flush()
        t = m.Technology(name="Qdrant", slug="qdrant", category_id=c.id, license="Apache-2.0"); s.add(t); s.flush()
        r = m.Repository(technology_id=t.id, source_platform="github", external_id="1",
                         repository_url="https://github.com/qdrant/qdrant", stars=300, open_issues=4)
        s.add(r); s.flush()
        now = datetime.now(timezone.utc)
        for i, v in enumerate([100, 200, 300]):
            s.add(m.MetricSnapshot(repository_id=r.id, stars=v, recorded_at=now - timedelta(days=2 - i)))
        s.commit()
    app.dependency_overrides[get_db] = lambda: Session(eng)
    return TestClient(app)


def test_list_search_and_profile():
    c = _client()
    assert c.get("/api/v1/technologies?q=qdr").json()[0]["slug"] == "qdrant"
    assert c.get("/api/v1/technologies?category=nope").json() == []
    p = c.get("/api/v1/technologies/qdrant").json()
    mom = {s["name"]: s["value"] for s in p["dimensions"]["momentum"]}
    assert mom["stars_gained_1d"] == 100 and mom["stars_gained_30d"] is None  # missing stays null
    assert p["freshness"]["status"] == "never"  # never synced => not claimed fresh
    assert "score" not in p
    assert c.get("/api/v1/technologies/zzz").status_code == 404
