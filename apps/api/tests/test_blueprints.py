import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as m
from app.api.routes import optional_user_id
from app.core.auth import current_user
from app.db import Base, get_db
from app.main import app

GRAPH = {"nodes": [{"id": "api", "kind": "component", "technology": "fastapi", "position": {"x": 0, "y": 0}, "data": {"label": "API"}},
                   {"id": "db", "kind": "component", "technology": "postgres", "position": {"x": 300, "y": 0}, "data": {"label": "DB"}}],
         "edges": [{"id": "e", "source": "api", "target": "db", "connection_type": "database_connection"}]}
BODY = {"title": "Simple API stack", "description": "A minimal API with a relational database for small products.",
        "difficulty": "beginner", "data_flows": ["client -> api -> db"], "known_limitations": ["single node"],
        "integration_notes": [{"from": "API", "to": "DB", "explanation": "API persists data"}]}


@pytest.fixture
def env():
    eng = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        cats = {k: m.Category(name=k, slug=k) for k in ("backend", "databases")}
        s.add_all(cats.values()); s.flush()
        s.add_all([m.Technology(name="FastAPI", slug="fastapi", category_id=cats["backend"].id),
                   m.Technology(name="PostgreSQL", slug="postgres", category_id=cats["databases"].id)])
        s.add_all([m.User(id="author", email="a@x", username="ann"), m.User(id="other", email="o@x"),
                   m.User(id="mod", email="m@x", is_admin=True)]); s.commit()
    who = {"id": "author", "anon": False}
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = lambda: Session(eng)

    def cu():
        if who["anon"]:
            raise HTTPException(401, "missing bearer token")
        with Session(eng) as s:
            return s.get(m.User, who["id"])
    app.dependency_overrides[current_user] = cu
    app.dependency_overrides[optional_user_id] = lambda: None if who["anon"] else who["id"]
    c = TestClient(app)
    arch = c.post("/api/v1/architectures", json={"title": "mine", "graph": GRAPH}).json()["id"]
    return c, who, arch


def submit(c, arch, **kw):
    return c.post("/api/v1/blueprints", json={**BODY, "architecture_id": arch, **kw})


def as_(who, uid):
    who.update(id=uid, anon=False)


def test_submission_is_pending_and_invisible_until_approved(env):
    c, who, arch = env
    r = submit(c, arch)
    assert r.status_code == 201 and r.json()["status"] == "pending"
    slug = r.json()["slug"]
    assert c.get("/api/v1/blueprints").json() == []                      # not listed
    assert c.get(f"/api/v1/blueprints/{slug}").json()["is_author"] is True  # author can preview
    as_(who, "other")
    assert c.get(f"/api/v1/blueprints/{slug}").status_code == 404           # others can't see it
    assert c.post(f"/api/v1/blueprints/{slug}/fork").status_code == 404     # nor fork it
    assert c.get("/api/v1/admin/blueprints").status_code == 403             # non-mods can't moderate
    as_(who, "mod")
    assert [b["slug"] for b in c.get("/api/v1/admin/blueprints").json()] == [slug]
    assert c.post(f"/api/v1/admin/blueprints/{slug}/approve", json={}).json()["status"] == "published"
    who["anon"] = True
    pub = c.get(f"/api/v1/blueprints/{slug}").json()
    assert pub["author"]["username"] == "ann" and pub["curated"] is False and "reviewed it for policy" in pub["notice"]
    assert [x["slug"] for x in c.get("/api/v1/blueprints").json()] == [slug]
    assert {x["slug"] for x in pub["component_facts"]} == {"fastapi", "postgres"} and pub["components"] == 2  # verified facts, not author claims


def test_reject_requires_note_and_author_sees_it(env):
    c, who, arch = env
    slug = submit(c, arch).json()["slug"]
    as_(who, "mod")
    assert c.post(f"/api/v1/admin/blueprints/{slug}/reject", json={}).status_code == 422
    c.post(f"/api/v1/admin/blueprints/{slug}/reject", json={"note": "Describe the data flow"})
    as_(who, "author")
    mine = c.get("/api/v1/blueprints/mine").json()
    assert mine[0]["status"] == "rejected" and mine[0]["moderation_note"] == "Describe the data flow"
    assert c.get("/api/v1/blueprints").json() == []


def test_fork_copies_pinned_version_privately_and_counts(env):
    c, who, arch = env
    slug = submit(c, arch).json()["slug"]
    as_(who, "mod"); c.post(f"/api/v1/admin/blueprints/{slug}/approve", json={})
    as_(who, "other")
    f = c.post(f"/api/v1/blueprints/{slug}/fork").json()
    a = c.get(f"/api/v1/architectures/{f['architecture_id']}").json()
    assert a["visibility"] == "private" and a["owner"] and len(a["graph"]["nodes"]) == 2 and a["title"].endswith("(fork)")
    assert c.get(f"/api/v1/blueprints/{slug}").json()["fork_count"] == 1
    # author's later edits to their own architecture don't change the published snapshot
    as_(who, "author")
    c.post(f"/api/v1/architectures/{arch}/versions", json={"graph": {"nodes": GRAPH["nodes"][:1], "edges": []}})
    assert len(c.get(f"/api/v1/blueprints/{slug}").json()["graph"]["nodes"]) == 2


def test_validation_and_abuse_guards(env):
    c, who, arch = env
    assert submit(c, arch, difficulty="godlike").status_code == 422
    assert submit(c, arch, description="Buy now http://a.co http://b.co http://c.co http://d.co at low prices").status_code == 422
    one = c.post("/api/v1/architectures", json={"title": "tiny", "graph": {"nodes": GRAPH["nodes"][:1], "edges": []}}).json()["id"]
    assert submit(c, one).status_code == 422                                  # needs >= 2 components
    as_(who, "other")
    assert submit(c, arch).status_code == 404                                 # can't publish someone else's design
    as_(who, "author")
    for _ in range(5):
        assert submit(c, arch).status_code == 201
    assert submit(c, arch).status_code == 429                                 # pending cap
    who["anon"] = True
    assert submit(c, arch).status_code == 401


def test_report_and_remove_flow(env):
    c, who, arch = env
    slug = submit(c, arch).json()["slug"]
    as_(who, "mod"); c.post(f"/api/v1/admin/blueprints/{slug}/approve", json={})
    as_(who, "author")
    assert c.post(f"/api/v1/blueprints/{slug}/report", json={"reason": "spam"}).status_code == 422  # own work
    as_(who, "other")
    assert c.post(f"/api/v1/blueprints/{slug}/report", json={"reason": "bogus"}).status_code == 422
    assert c.post(f"/api/v1/blueprints/{slug}/report", json={"reason": "inaccurate", "details": "wrong"}).status_code == 201
    assert c.post(f"/api/v1/blueprints/{slug}/report", json={"reason": "spam"}).status_code == 409   # once per user
    assert c.get("/api/v1/admin/reports").status_code == 403
    as_(who, "mod")
    rep = c.get("/api/v1/admin/reports").json()
    assert len(rep) == 1 and rep[0]["blueprint"]["slug"] == slug
    assert c.post(f"/api/v1/admin/reports/{rep[0]['id']}/resolve", json={"action": "remove_blueprint", "note": "inaccurate"}).json()["status"] == "actioned"
    who["anon"] = True
    assert c.get(f"/api/v1/blueprints/{slug}").status_code == 404 and c.get("/api/v1/blueprints").json() == []
    as_(who, "author")
    assert c.get("/api/v1/blueprints/mine").json()[0]["status"] == "removed"
    assert c.post(f"/api/v1/blueprints/{slug}/versions", json={"architecture_id": arch}).status_code == 404  # can't revive


def test_new_version_returns_community_blueprint_to_review(env):
    c, who, arch = env
    slug = submit(c, arch).json()["slug"]
    as_(who, "mod"); c.post(f"/api/v1/admin/blueprints/{slug}/approve", json={})
    as_(who, "author")
    r = c.post(f"/api/v1/blueprints/{slug}/versions", json={"architecture_id": arch, "changelog": "tweak"}).json()
    assert r == {"version": 2, "status": "pending"}
    who["anon"] = True
    assert c.get("/api/v1/blueprints").json() == []
    as_(who, "author")
    d = c.get(f"/api/v1/blueprints/{slug}").json()
    assert [v["version"] for v in d["versions"]] == [2, 1]


def test_fork_public_architecture_only(env):
    c, who, arch = env
    as_(who, "other")
    assert c.post(f"/api/v1/architectures/{arch}/fork").status_code == 404   # private
    as_(who, "author"); c.patch(f"/api/v1/architectures/{arch}", json={"visibility": "public"})
    as_(who, "other")
    f = c.post(f"/api/v1/architectures/{arch}/fork").json()
    assert c.get(f"/api/v1/architectures/{f['architecture_id']}").json()["owner"] is True
