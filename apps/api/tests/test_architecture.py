import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as m
from app.api.routes import optional_user_id
from app.architecture.schema import Graph
from app.architecture.validation import validate_graph
from app.core.auth import current_user
from app.db import Base, get_db
from app.main import app


def node(i, tech=None, kind="component", **kw):
    return {"id": i, "kind": kind, "technology": tech, "position": {"x": 0, "y": 0},
            "data": {"label": i, **kw}}


def edge(i, s, t, c="http_api"):
    return {"id": i, "source": s, "target": t, "connection_type": c}


@pytest.fixture
def env():
    eng = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        cats = {k: m.Category(name=k, slug=k) for k in ("frontend", "backend", "databases", "vector-databases")}
        s.add_all(cats.values()); s.flush()
        for slug, cat in [("nextjs", "frontend"), ("fastapi", "backend"), ("postgres", "databases"), ("qdrant", "vector-databases")]:
            s.add(m.Technology(name=slug, slug=slug, category_id=cats[cat].id))
        s.add_all([m.User(id="u1", email="a@x"), m.User(id="u2", email="b@x")]); s.commit()
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = lambda: Session(eng)
    who = {"id": "u1", "anon": False}

    def _cu():
        if who["anon"]:
            raise HTTPException(401, "missing bearer token")
        return m.User(id=who["id"], email="x@x")

    app.dependency_overrides[current_user] = _cu
    app.dependency_overrides[optional_user_id] = lambda: None if who["anon"] else who["id"]
    return TestClient(app), who, eng


GOOD = {"nodes": [node("web", "nextjs"), node("api", "fastapi"), node("db", "postgres")],
        "edges": [edge("e1", "web", "api"), edge("e2", "api", "db", "database_connection")]}


def report(eng, g):
    with Session(eng) as s:
        return validate_graph(s, Graph.model_validate(g))


def test_valid_graph_edge_statuses(env):
    _, _, eng = env
    r = report(eng, GOOD)
    assert r.errors == [] and r.edge_status == {"e1": "compatible", "e2": "compatible"}


def test_rejects_structural_errors(env):
    _, _, eng = env
    bad = {"nodes": [node("a", "nextjs"), node("a", "fastapi"), node("n", "ghost"), node("c")],
           "edges": [edge("e1", "a", "zzz"), edge("e2", "a", "a")]}
    codes = {i.code for i in report(eng, bad).errors}
    assert {"duplicate_node_id", "unknown_technology", "component_without_technology", "dangling_edge"} <= codes
    assert "self_loop" in {i.code for i in report(eng, {"nodes": [node("a", "nextjs")], "edges": [edge("e", "a", "a")]}).errors}


def test_unknown_types_rejected_by_schema():
    with pytest.raises(ValueError):
        Graph.model_validate({"nodes": [], "edges": [{"id": "e", "source": "a", "target": "b", "connection_type": "magic"}]})


def test_custom_and_unruled_connections_are_unverified_not_rejected(env):
    _, _, eng = env
    g = {"nodes": [node("db", "postgres"), node("web", "nextjs")],
         "edges": [edge("e1", "db", "web", "http_api"), edge("e2", "web", "db", "custom")]}
    r = report(eng, g)
    assert r.errors == [] and r.edge_status == {"e1": "unverified", "e2": "unverified"}
    assert [i.code for i in r.issues] == ["no_structural_rule"]


def test_verified_relationship_upgrades_edge(env):
    _, _, eng = env
    with Session(eng) as s:
        ids = {t.slug: t.id for t in s.query(m.Technology)}
        s.add(m.TechnologyRelationship(source_technology_id=ids["postgres"], target_technology_id=ids["nextjs"],
                                       relationship_type="integrates", verification_status="verified")); s.commit()
    g = {"nodes": [node("web", "nextjs"), node("db", "postgres")], "edges": [edge("e", "web", "db", "database_connection")]}
    assert report(eng, g).edge_status["e"] == "verified"


def test_group_parent_and_disconnected_warning(env):
    _, _, eng = env
    g = {"nodes": [node("g", kind="group"), {**node("a", "nextjs"), "parent": "g"}, node("b", "fastapi"),
                   {**node("c", "postgres"), "parent": "b"}], "edges": []}
    r = report(eng, g)
    assert [i.ref for i in r.errors] == ["c"]
    assert {i.code for i in r.issues if i.level == "warning"} == {"disconnected_node"}


def test_save_versions_restore_duplicate(env):
    c, _, _ = env
    a = c.post("/api/v1/architectures", json={"title": "RAG", "graph": GOOD}).json()
    assert a["latest_version"] == 1 and a["visibility"] == "private"
    smaller = {"nodes": GOOD["nodes"][:1], "edges": []}
    assert c.post(f"/api/v1/architectures/{a['id']}/versions", json={"graph": smaller, "note": "trim"}).json()["version_number"] == 2
    assert len(c.get(f"/api/v1/architectures/{a['id']}").json()["graph"]["nodes"]) == 1
    assert c.post(f"/api/v1/architectures/{a['id']}/restore/1").json()["version_number"] == 3
    assert len(c.get(f"/api/v1/architectures/{a['id']}").json()["graph"]["nodes"]) == 3
    assert [v["version_number"] for v in c.get(f"/api/v1/architectures/{a['id']}/versions").json()] == [3, 2, 1]  # history intact
    d = c.post(f"/api/v1/architectures/{a['id']}/duplicate").json()
    assert d["title"] == "RAG (copy)" and d["forked_from_id"] == a["id"]


def test_invalid_graph_not_saved(env):
    c, _, _ = env
    r = c.post("/api/v1/architectures", json={"title": "x", "graph": {"nodes": [node("a", "ghost")], "edges": []}})
    assert r.status_code == 422 and r.json()["detail"]["report"]["issues"][0]["code"] == "unknown_technology"
    assert c.get("/api/v1/architectures").json() == []


def test_ownership_and_visibility(env):
    c, who, _ = env
    a = c.post("/api/v1/architectures", json={"title": "mine", "graph": GOOD}).json()
    who["id"] = "u2"
    for call in (lambda: c.get(f"/api/v1/architectures/{a['id']}/versions"),
                 lambda: c.patch(f"/api/v1/architectures/{a['id']}", json={"title": "hax"}),
                 lambda: c.delete(f"/api/v1/architectures/{a['id']}"),
                 lambda: c.post(f"/api/v1/architectures/{a['id']}/restore/1"),
                 lambda: c.post(f"/api/v1/architectures/{a['id']}/duplicate")):
        assert call().status_code == 404
    assert c.get(f"/api/v1/architectures/{a['id']}").status_code == 404  # others can't read private designs
    who["anon"] = True
    assert c.get(f"/api/v1/architectures/{a['id']}").status_code == 404  # nor anonymous visitors
    assert c.post("/api/v1/architectures", json={"title": "x"}).status_code == 401
    who.update(id="u1", anon=False)
    c.patch(f"/api/v1/architectures/{a['id']}", json={"visibility": "public"})
    who["anon"] = True
    assert c.get(f"/api/v1/architectures/{a['id']}").json()["owner"] is False  # public, read-only


def test_collections_and_components(env):
    c, _, _ = env
    col = c.post("/api/v1/collections", json={"name": "Side projects"}).json()
    a = c.post("/api/v1/architectures", json={"title": "t", "collection_id": col["id"]}).json()
    assert a["collection_id"] == col["id"]
    assert c.post("/api/v1/architectures", json={"title": "t", "collection_id": "nope"}).status_code == 404
    comps = c.get("/api/v1/components?component_type=vector_database").json()
    assert [x["slug"] for x in comps] == ["qdrant"]
