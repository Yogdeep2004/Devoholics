"""Deterministic application of a validated Proposal to a Graph. The LLM never edits anything itself."""
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.schemas import (
    AddEdge,
    AddNode,
    Proposal,
    RemoveEdge,
    RemoveNode,
    ReplaceNode,
    UpdateNode,
)
from app.architecture.rules import component_type_for
from app.architecture.schema import Edge, Graph, Node, NodeData, Position
from app.architecture.validation import validate_graph
from app.models import Technology


@dataclass
class Applied:
    graph: Graph | None
    preview: Graph | None
    diff: dict
    errors: list[dict] = field(default_factory=list)
    validation: dict | None = None


def _err(errors, i, code, msg):
    errors.append({"operation": i, "code": code, "message": msg})


def apply_proposal(db: Session, base: Graph, proposal: Proposal, only: list[int] | None = None) -> Applied:
    g = base.model_copy(deep=True)
    nodes: dict[str, Node] = {n.id: n for n in g.nodes}
    edges: dict[str, Edge] = {e.id: e for e in g.edges}
    refs: dict[str, str] = {}
    removed_nodes: dict[str, Node] = {}
    removed_edges: dict[str, Edge] = {}
    diff = {"added_nodes": [], "removed_nodes": [], "changed_nodes": [], "added_edges": [], "removed_edges": []}
    errors: list[dict] = []
    max_x = max([n.position.x for n in g.nodes], default=-260)
    added = 0

    def tech(slug):
        return db.scalar(select(Technology).where(Technology.slug == slug))

    def resolve(x):
        return refs.get(x, x)

    def drop_node(nid):
        removed_nodes[nid] = nodes.pop(nid)
        diff["removed_nodes"].append(nid)
        for eid in [e.id for e in edges.values() if nid in (e.source, e.target)]:
            removed_edges[eid] = edges.pop(eid); diff["removed_edges"].append(eid)

    for i, op in enumerate(proposal.operations):
        if only is not None and i not in only:
            continue
        if isinstance(op, AddNode):
            t = tech(op.technology_id)
            if not t:
                _err(errors, i, "unknown_technology", f"Technology '{op.technology_id}' does not exist"); continue
            if op.ref in refs:
                _err(errors, i, "duplicate_ref", f"Reference '{op.ref}' is used more than once"); continue
            nid, k = "ai_" + re.sub(r"[^A-Za-z0-9_.-]", "_", op.ref), 1
            while nid in nodes or nid in removed_nodes:
                k += 1; nid = f"ai_{op.ref}_{k}"
            refs[op.ref] = nid
            nodes[nid] = Node(id=nid, kind="component", technology=t.slug,
                              position=Position(x=max_x + 260 + (added // 4) * 260, y=(added % 4) * 120),
                              data=NodeData(label=op.label or t.name, layer=op.layer,
                                            component_type=component_type_for(t.category.slug),
                                            notes=f"AI-suggested: {op.reason}"[:4000]))
            added += 1; diff["added_nodes"].append(nid)
        elif isinstance(op, RemoveNode):
            if op.target_node not in nodes:
                _err(errors, i, "unknown_node", f"Node '{op.target_node}' does not exist"); continue
            drop_node(op.target_node)
        elif isinstance(op, ReplaceNode):
            n = nodes.get(op.target_node)
            if n is None or n.kind != "component":
                _err(errors, i, "unknown_node", f"Component '{op.target_node}' does not exist"); continue
            t = tech(op.replacement.technology_id)
            if not t:
                _err(errors, i, "unknown_technology", f"Technology '{op.replacement.technology_id}' does not exist"); continue
            if op.connections_to_preserve is not None:
                keep = set(op.connections_to_preserve)
                bad = keep - set(nodes)
                if bad:
                    _err(errors, i, "unknown_node", f"connections_to_preserve references missing nodes: {sorted(bad)}"); continue
                for e in [e for e in edges.values() if op.target_node in (e.source, e.target)]:
                    other = e.target if e.source == op.target_node else e.source
                    if other not in keep:
                        removed_edges[e.id] = edges.pop(e.id); diff["removed_edges"].append(e.id)
            n.technology = t.slug
            n.data.label, n.data.component_type = t.name, component_type_for(t.category.slug)
            n.data.notes = (n.data.notes + f"\nAI-suggested replacement: {op.replacement.reason}").strip()[:4000]
            if n.id not in diff["changed_nodes"]:
                diff["changed_nodes"].append(n.id)
        elif isinstance(op, UpdateNode):
            n = nodes.get(op.target_node)
            if n is None:
                _err(errors, i, "unknown_node", f"Node '{op.target_node}' does not exist"); continue
            for f in ("label", "notes", "layer"):
                v = getattr(op, f)
                if v is not None:
                    setattr(n.data, f, v)
            if n.id not in diff["changed_nodes"]:
                diff["changed_nodes"].append(n.id)
        elif isinstance(op, AddEdge):
            s, t_ = resolve(op.source), resolve(op.target)
            if s not in nodes or t_ not in nodes:
                _err(errors, i, "unknown_node", f"Edge references a missing node ({op.source} → {op.target})"); continue
            if any((e.source, e.target, e.connection_type) == (s, t_, op.connection_type) for e in edges.values()):
                _err(errors, i, "duplicate_edge", f"Connection {s} → {t_} ({op.connection_type}) already exists"); continue
            eid, k = f"ai_e{len(edges) + len(removed_edges) + 1}", 1
            while eid in edges or eid in removed_edges:
                k += 1; eid = f"ai_e{len(edges) + len(removed_edges) + k}"
            edges[eid] = Edge(id=eid, source=s, target=t_, connection_type=op.connection_type, label=op.label,
                              notes=f"AI-suggested: {op.reason}"[:2000])
            diff["added_edges"].append(eid)
        elif isinstance(op, RemoveEdge):
            if op.edge_id not in edges:
                _err(errors, i, "unknown_edge", f"Edge '{op.edge_id}' does not exist"); continue
            removed_edges[op.edge_id] = edges.pop(op.edge_id); diff["removed_edges"].append(op.edge_id)

    result = Graph(nodes=list(nodes.values()), edges=list(edges.values()))
    if errors:
        return Applied(None, None, diff, errors)
    rep = validate_graph(db, result)
    if rep.errors:
        return Applied(None, None, diff, [{"operation": None, "code": x.code, "message": x.message} for x in rep.errors])
    preview = Graph(nodes=result.nodes + list(removed_nodes.values()), edges=result.edges + list(removed_edges.values()))
    return Applied(result, preview, diff, [], rep.to_dict())
