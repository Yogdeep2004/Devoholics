"""Deterministic architecture review rules. These are rule-based findings, labelled source='rule'."""
from collections import Counter

from sqlalchemy.orm import Session

from app.ai.context import node_types, tech_facts
from app.ai.schemas import Finding
from app.architecture.rules import component_type_for  # noqa: F401
from app.architecture.schema import Graph
from app.architecture.validation import validate_graph

STALE_DAYS = 180


def rule_review(db: Session, g: Graph) -> list[Finding]:
    F = lambda sev, cat, title, expl, nodes=(): Finding(severity=sev, category=cat, title=title, explanation=expl,
                                                         nodes=list(nodes), source="rule")
    out: list[Finding] = []
    rep = validate_graph(db, g)
    for i in rep.issues:
        if i.code == "disconnected_node":
            out.append(F("low", "structure", "Disconnected component", i.message, [i.ref] if i.ref else []))
        elif i.level == "error":
            out.append(F("high", "structure", "Invalid graph", i.message, [i.ref] if i.ref else []))
    comps = [n for n in g.nodes if n.kind == "component"]
    types = node_types(db, g)
    types = {n.id: types[n.id] for n in comps}
    kinds = Counter(types.values())
    if comps and "monitoring" not in kinds:
        out.append(F("medium", "observability", "No monitoring or observability component",
                     "Nothing in this design collects metrics, traces or logs, so failures and LLM costs would be hard to see."))
    if ("frontend" in kinds and ("backend" in kinds or "api" in kinds)
            and not any(e.connection_type == "authentication" for e in g.edges)):
        out.append(F("medium", "security", "No authentication connection",
                     "A frontend talks to a backend but no connection is marked as authentication. Confirm how users and services authenticate."))
    for t, label in (("vector_database", "vector databases"), ("orchestrator", "orchestration frameworks"), ("agent", "agent frameworks")):
        if kinds.get(t, 0) > 1:
            out.append(F("low", "duplication", f"Multiple {label}",
                         f"The design has {kinds[t]} components of type {t}. Check whether they duplicate functionality.",
                         [n.id for n in comps if types[n.id] == t]))
    deg = Counter()
    for e in g.edges:
        deg[e.source] += 1; deg[e.target] += 1
    for nid, d in deg.items():
        if d >= 6:
            out.append(F("medium", "scalability", "Highly connected component",
                         f"This component has {d} connections and may become a bottleneck or single point of failure.", [nid]))
    if len(comps) > 15:
        out.append(F("low", "complexity", "Large design",
                     f"{len(comps)} components is a lot to operate. Consider whether every one is needed."))
    unver = [e.id for e in g.edges if rep.edge_status.get(e.id) == "unverified"]
    if unver:
        out.append(F("info", "integration", f"{len(unver)} unverified connection(s)",
                     "These connections are custom or have no known pattern/verified integration on record. Check each against the tools' documentation."))
    for n in comps:
        f = tech_facts(db, n.technology) if n.technology else None
        if f and f["days_since_last_push"] is not None and f["days_since_last_push"] > STALE_DAYS:
            out.append(F("medium", "maintenance", f"{f['name']} shows no recent activity",
                         f"No repository pushes for {f['days_since_last_push']} days (source: {f['source']}).", [n.id]))
    return out
