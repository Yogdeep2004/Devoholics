from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models as m
from app.db import Base
from app.main import app


def test_health():
    assert TestClient(app).get("/health").json() == {"status": "ok"}


def test_schema_and_constraints():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        c = m.Category(name="AI", slug="ai")
        s.add(c); s.flush()
        t = m.Technology(name="X", slug="x", category_id=c.id)
        s.add(t); s.flush()
        s.add(m.Repository(technology_id=t.id, source_platform="github", external_id="1", repository_url="u"))
        s.commit()
        s.add(m.Technology(name="Y", slug="x", category_id=c.id))
        try:
            s.commit(); assert False, "duplicate slug allowed"
        except Exception:
            s.rollback()
