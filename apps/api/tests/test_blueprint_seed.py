from app.architecture.rules import (
    COMPONENT_TYPES,
    CONNECTION_TYPES,
    component_type_for,
    rule_allows,
)
from app.blueprints_seed import BLUEPRINTS
from app.seed import CATEGORIES, TECHS

TECH = {t[0]: t for t in TECHS}


def ctype(node):
    return node["ctype"] or component_type_for(TECH[node["technology"]][2])


def test_curated_set_matches_the_spec_list():
    assert {b["slug"] for b in BLUEPRINTS} == {
        "rag-application", "multi-agent-research-assistant", "ai-coding-assistant", "voice-ai-assistant",
        "ai-customer-support-agent", "ai-saas-application", "document-processing-pipeline", "computer-vision-application"}


def test_every_blueprint_is_internally_consistent_and_complete():
    for b in BLUEPRINTS:
        ids = [n["id"] for n in b["nodes"]]
        assert len(ids) == len(set(ids)) >= 5, b["slug"]
        assert all(n["technology"] in TECH for n in b["nodes"]), b["slug"]              # only real catalogue technologies
        assert all(n["ctype"] is None or n["ctype"] in COMPONENT_TYPES for n in b["nodes"])
        eids = [e["id"] for e in b["edges"]]
        assert len(eids) == len(set(eids))
        for e in b["edges"]:
            assert e["source"] in ids and e["target"] in ids and e["source"] != e["target"], (b["slug"], e["id"])
            assert e["connection_type"] in CONNECTION_TYPES
        assert b["difficulty"] in {"beginner", "intermediate", "advanced"}
        for k in ("description", "data_flows", "integration", "infra", "limits"):
            assert b[k], (b["slug"], k)                                                  # every section the spec requires
        assert any(n["layer"] for n in b["nodes"])


def test_non_custom_edges_follow_known_structural_patterns():
    """Custom edges are allowed (and shown as unverified); every other edge must match a documented pattern."""
    for b in BLUEPRINTS:
        types = {n["id"]: ctype(n) for n in b["nodes"]}
        for e in b["edges"]:
            if e["connection_type"] != "custom":
                assert rule_allows(types[e["source"]], types[e["target"]], e["connection_type"]), (b["slug"], e)


def test_seed_categories_cover_all_technologies():
    assert all(t[2] in CATEGORIES for t in TECHS)
