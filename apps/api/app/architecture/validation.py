from dataclasses import dataclass, field

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.architecture.rules import component_type_for, rule_allows
from app.architecture.schema import Graph
from app.models import Technology, TechnologyRelationship


@dataclass
class Issue:
    level: str  # error | warning | info
    code: str
    message: str
    ref: str | None = None


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)
    edge_status: dict[str, str] = field(default_factory=dict)  # edge id -> verified | compatible | unverified

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "error"]

    def to_dict(self) -> dict:
        return {"ok": not self.errors, "issues": [i.__dict__ for i in self.issues], "edge_status": self.edge_status}


def validate_graph(db: Session, g: Graph) -> Report:
    r = Report()
    err = lambda code, msg, ref=None: r.issues.append(Issue("error", code, msg, ref))
    warn = lambda code, msg, ref=None: r.issues.append(Issue("warning", code, msg, ref))

    ids = [n.id for n in g.nodes]
    for d in {i for i in ids if ids.count(i) > 1}:
        err("duplicate_node_id", f"Node id '{d}' is used more than once", d)
    eids = [e.id for e in g.edges]
    for d in {i for i in eids if eids.count(i) > 1}:
        err("duplicate_edge_id", f"Edge id '{d}' is used more than once", d)
    nodes = {n.id: n for n in g.nodes}

    slugs = {n.technology for n in g.nodes if n.technology}
    techs = {t.slug: t for t in db.scalars(select(Technology).where(Technology.slug.in_(slugs)))} if slugs else {}
    ctype: dict[str, str] = {}
    for n in g.nodes:
        if n.kind == "component":
            if not n.technology:
                err("component_without_technology", f"Component '{n.data.label}' must reference a technology", n.id)
                continue
            t = techs.get(n.technology)
            if not t:
                err("unknown_technology", f"Technology '{n.technology}' does not exist", n.id)
                continue
            ctype[n.id] = n.data.component_type or component_type_for(t.category.slug)
        elif n.technology:
            err("technology_on_non_component", f"{n.kind} nodes cannot reference a technology", n.id)
        if n.parent:
            p = nodes.get(n.parent)
            if p is None or p.kind != "group" or n.parent == n.id:
                err("invalid_parent", f"Parent '{n.parent}' is not an existing group", n.id)

    tech_ids = {n.id: techs[n.technology].id for n in g.nodes if n.technology in techs}
    connected: set[str] = set()
    for e in g.edges:
        s, t = nodes.get(e.source), nodes.get(e.target)
        if s is None or t is None:
            err("dangling_edge", f"Edge '{e.id}' references a missing node", e.id); continue
        if e.source == e.target:
            err("self_loop", f"Edge '{e.id}' connects a node to itself", e.id); continue
        if s.kind != "component" or t.kind != "component":
            err("edge_on_non_component", "Edges may only connect components", e.id); continue
        connected |= {e.source, e.target}
        r.edge_status[e.id] = _edge_status(db, e, ctype, tech_ids)
        if r.edge_status[e.id] == "unverified" and e.connection_type != "custom":
            warn("no_structural_rule", f"No known pattern for {ctype.get(e.source)} → {ctype.get(e.target)} "
                 f"via {e.connection_type}; marked unverified", e.id)

    comps = [n for n in g.nodes if n.kind == "component" and n.id in ctype]
    if len(comps) > 1:
        for n in comps:
            if n.id not in connected:
                warn("disconnected_node", f"'{n.data.label}' is not connected to anything", n.id)
    return r


def _edge_status(db: Session, e, ctype: dict[str, str], tech_ids: dict[str, int]) -> str:
    a, b = tech_ids.get(e.source), tech_ids.get(e.target)
    if a and b and db.scalar(select(TechnologyRelationship.id).where(
            TechnologyRelationship.verification_status == "verified",
            or_((TechnologyRelationship.source_technology_id == a) & (TechnologyRelationship.target_technology_id == b),
                (TechnologyRelationship.source_technology_id == b) & (TechnologyRelationship.target_technology_id == a)))):
        return "verified"
    if e.connection_type != "custom" and rule_allows(ctype.get(e.source, ""), ctype.get(e.target, ""), e.connection_type):
        return "compatible"
    return "unverified"


def normalize_graph(db: Session, g: Graph) -> Graph:
    """Fill each component's missing component_type from its technology so every renderer agrees."""
    g = g.model_copy(deep=True)
    slugs = {n.technology for n in g.nodes if n.technology}
    techs = {t.slug: t for t in db.scalars(select(Technology).where(Technology.slug.in_(slugs)))} if slugs else {}
    for n in g.nodes:
        if n.kind == "component" and n.data.component_type is None and n.technology in techs:
            n.data.component_type = component_type_for(techs[n.technology].category.slug)
    return g
