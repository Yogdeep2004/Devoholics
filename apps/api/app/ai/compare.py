"""Deterministic comparison of two architecture graphs, using only our database."""
from collections import Counter

from sqlalchemy.orm import Session

from app.ai.context import node_types, tech_facts
from app.architecture.schema import Graph
from app.architecture.validation import validate_graph

OPEN = {"MIT", "Apache-2.0", "BSD-3-Clause", "BSD-2-Clause", "MPL-2.0", "ISC", "GPL-3.0", "AGPL-3.0", "LGPL-3.0"}
MANAGED = {"external_service"}


def summarize(db: Session, g: Graph) -> dict:
    comps = [n for n in g.nodes if n.kind == "component"]
    types = node_types(db, g)
    facts = [tech_facts(db, n.technology) for n in comps if n.technology]
    facts = [f for f in facts if f]
    lic = [f["license"] for f in facts]
    rep = validate_graph(db, g)
    return {"components": len(comps), "connections": len(g.edges),
            "technologies": sorted(f["slug"] for f in facts),
            "by_type": dict(Counter(types[n.id] for n in comps)),
            "layers": sorted({n.data.layer for n in comps if n.data.layer}),
            "open_source_licensed": sum(1 for x in lic if x in OPEN), "license_unknown": sum(1 for x in lic if x is None),
            "external_services": sum(1 for n in comps if types[n.id] in MANAGED),
            "infrastructure_components": sum(1 for n in comps if types[n.id] == "infrastructure"),
            "has_monitoring": any(types[n.id] == "monitoring" for n in comps),
            "stale_technologies": sorted(f["slug"] for f in facts if (f["days_since_last_push"] or 0) > 180),
            "unverified_connections": sum(1 for s in rep.edge_status.values() if s == "unverified"),
            "validation_warnings": len([i for i in rep.issues if i.level == "warning"])}


def compare(db: Session, a: Graph, b: Graph) -> dict:
    sa, sb = summarize(db, a), summarize(db, b)
    ta, tb = set(sa["technologies"]), set(sb["technologies"])
    return {"a": sa, "b": sb, "only_in_a": sorted(ta - tb), "only_in_b": sorted(tb - ta), "shared": sorted(ta & tb),
            "note": "Counts come from the graphs and DEVOHOLICS data. Cost and scalability are not computed; "
                    "use the AI narrative for assumptions-based discussion."}
