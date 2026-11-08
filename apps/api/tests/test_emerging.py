import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as m
from app.collectors.github import RepoData
from app.db import Base, get_db
from app.main import app
from app.services.discover import discover
from app.services.usecases import generate_use_cases

NOW = datetime.now(timezone.utc)


def hit(name, stars, age_days, **kw):
    d = dict(external_id=name, full_name=f"o/{name}", url=f"https://github.com/o/{name}", description=f"{name} does things", homepage=None, license="MIT",
             topics=["mcp-server"], stars=stars, forks=1, open_issues=0, contributors=None, last_commit_at=NOW, archived=False, created_at=NOW - timedelta(days=age_days))
    d.update(kw)
    return RepoData(**d)


class FakeGH:
    def __init__(self, hits): self.hits, self.queries = hits, []
    def search(self, q, per_page=30):
        self.queries.append(q); return self.hits


@pytest.fixture
def eng():
    e = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(e)
    with Session(e) as s:
        for slug in ("mcp", "agent-frameworks", "llm-inference", "rag", "vector-databases", "dev-tools"):
            s.add(m.Category(name=slug, slug=slug))
        s.commit()
    return e


def test_discover_adds_only_usable_new_repos_and_is_idempotent(eng):
    hits = [hit("fresh", 900, 9), hit("awesome-mcp", 5000, 5), hit("archived", 800, 5, archived=True), hit("nodesc", 700, 5, description=None)]
    with Session(eng) as s:
        gh = FakeGH(hits)
        assert discover(s, gh, now=NOW) == 1  # one theme query returns the same hits for every theme; dedup keeps a single tool
        assert "created:>=" in gh.queries[0] and "stars:>=30" in gh.queries[0] and gh.queries[0].startswith("topic:mcp-server")
        t = s.scalar(select(m.Technology).where(m.Technology.slug == "gh-o-fresh"))
        assert t.name == "fresh" and t.category.slug == "mcp" and t.repositories[0].repo_created_at is not None
        ev = s.scalars(select(m.FeedEvent)).all()
        assert [e.event_type for e in ev] == ["new_tool"] and ev[0].event_metadata["age_days"] == 9
        assert discover(s, FakeGH(hits), now=NOW) == 0
        assert s.scalar(select(func.count(m.FeedEvent.id))) == 1  # no duplicate events


def test_emerging_endpoint_ranks_by_velocity_and_excludes_old_or_tiny(eng):
    with Session(eng) as s:
        cat = s.scalar(select(m.Category))
        for name, stars, age in [("fast", 1000, 10), ("slow", 300, 50), ("old", 5000, 400), ("tiny", 10, 5)]:
            t = m.Technology(name=name, slug=name, category_id=cat.id, use_cases={"headline": f"Use {name}", "applications": ["a"], "ai_generated": True} if name == "fast" else None)
            s.add(t); s.flush()
            s.add(m.Repository(technology_id=t.id, source_platform="github", external_id=name, repository_url=f"https://github.com/o/{name}",
                               stars=stars, repo_created_at=NOW - timedelta(days=age), topics=["x"]))
        s.commit()
    app.dependency_overrides[get_db] = lambda: Session(eng)
    r = TestClient(app).get("/api/v1/trending/emerging?days=90").json()
    assert [i["slug"] for i in r["items"]] == ["fast", "slow"]
    assert r["items"][0]["stars_per_day"] == 100.0 and r["items"][0]["use_cases"]["ai_generated"] is True
    assert r["items"][0]["stars_gained_7d"] is None and "average" in r["note"]  # honest about what the number means


class Scripted:
    def __init__(self, *r): self.r = list(r)
    def complete(self, system, user): return json.dumps(self.r.pop(0))


def _tool(s, slug, desc="A tool"):
    cat = s.scalar(select(m.Category))
    t = m.Technology(name=slug, slug=slug, category_id=cat.id, description=desc); s.add(t); s.flush()
    s.add(m.Repository(technology_id=t.id, source_platform="github", external_id=slug, repository_url=f"https://github.com/o/{slug}", stars=50, topics=["t"]))


def test_use_cases_are_stored_labelled_and_ignore_invented_slugs(eng):
    with Session(eng) as s:
        _tool(s, "alpha"); s.commit()
        llm = Scripted({"items": [{"slug": "alpha", "headline": "Use alpha to test things", "applications": ["Test an API", "Mock a service"]},
                                  {"slug": "ghost", "headline": "invented", "applications": ["x"]}]})
        assert generate_use_cases(s, llm, sleep=lambda x: None) == 1
        t = s.scalar(select(m.Technology).where(m.Technology.slug == "alpha"))
        assert t.use_cases["ai_generated"] is True and t.use_cases["applications"] == ["Test an API", "Mock a service"]
        assert s.scalar(select(m.Technology).where(m.Technology.slug == "ghost")) is None
        assert generate_use_cases(s, Scripted(), sleep=lambda x: None) == 0  # nothing left to fill


def test_use_cases_skip_cleanly_without_llm(eng):
    from app.ai.provider import NotConfiguredLLM
    with Session(eng) as s:
        _tool(s, "beta"); s.commit()
        assert generate_use_cases(s, NotConfiguredLLM(), sleep=lambda x: None) == 0
        assert s.scalar(select(m.Technology.use_cases).where(m.Technology.slug == "beta")) is None


def test_list_and_feed_do_not_issue_one_query_per_row(eng):
    """Regression: lazy category/repository loads made /feed take 7s over a remote DB."""
    from sqlalchemy import event
    with Session(eng) as s:
        cat = s.scalar(select(m.Category))
        for i in range(25):
            t = m.Technology(name=f"t{i}", slug=f"t{i}", category_id=cat.id); s.add(t); s.flush()
            s.add(m.Repository(technology_id=t.id, source_platform="github", external_id=str(i), repository_url=f"https://github.com/o/t{i}", stars=i + 1))
            s.add(m.FeedEvent(technology_id=t.id, event_type="new_release", event_title=f"t{i} 1.0", detected_at=NOW))
        s.commit()
    app.dependency_overrides[get_db] = lambda: Session(eng)
    count = {"n": 0}
    event.listen(eng, "before_cursor_execute", lambda *a, **k: count.__setitem__("n", count["n"] + 1))
    c = TestClient(app)
    assert len(c.get("/api/v1/technologies?limit=25").json()) == 25
    assert count["n"] <= 4, f"/technologies ran {count['n']} queries for 25 rows"
    count["n"] = 0
    assert len(c.get("/api/v1/feed?window=30d&limit=25").json()) == 25
    assert count["n"] <= 8, f"/feed ran {count['n']} queries for 25 cards"
