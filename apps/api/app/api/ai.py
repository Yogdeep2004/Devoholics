import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import compare as cmp
from app.ai.apply import apply_proposal
from app.ai.context import OPS_SCHEMA, SYSTEM, candidates, clean, fence, graph_summary, tech_facts
from app.ai.provider import LLM, LLMNotConfigured, get_llm
from app.ai.review import rule_review
from app.ai.schemas import AIReview, Objective, Proposal
from app.ai.service import AIOutputError, ask
from app.api.architectures import _add_version, _get_owned, _latest
from app.architecture.schema import Graph
from app.core.auth import current_user
from app.core.config import settings
from app.db import get_db
from app.models import AISuggestion, User

router = APIRouter(prefix="/api/v1/architectures", tags=["ai"])

_hits: dict[str, deque] = defaultdict(deque)


def ai_rate_limit(user: User = Depends(current_user)) -> User:
    """Sliding-window limit per user so one account can't burn the shared free-tier quota."""
    now, q = time.monotonic(), _hits[user.id]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= settings.ai_requests_per_minute:
        raise HTTPException(429, "Too many AI requests; try again in a minute")
    q.append(now)
    return user


class PromptIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)


class ExplainIn(BaseModel):
    node_id: str | None = None
    edge_id: str | None = None
    question: str | None = Field(None, max_length=1000)


class AltIn(BaseModel):
    node_id: str
    question: str | None = Field(None, max_length=1000)


class OptimizeIn(BaseModel):
    objective: Objective
    note: str | None = Field(None, max_length=1000)


class AcceptIn(BaseModel):
    operation_indexes: list[int] | None = None


class Ref(BaseModel):
    id: str
    version: int | None = None


class CompareIn(BaseModel):
    a: Ref
    b: Ref
    narrate: bool = False


class Explanation(BaseModel):
    answer: str = Field(max_length=4000)


class Narrative(BaseModel):
    narrative: str = Field(max_length=4000)
    assumptions: list[str] = Field(default_factory=list, max_length=10)


def _graph(a) -> Graph:
    return Graph.model_validate(_latest(a).graph_json)


def _ai_call(llm: LLM, user: str, model):
    try:
        return ask(llm, SYSTEM, user, model)
    except LLMNotConfigured as e:
        raise HTTPException(503, str(e)) from e
    except AIOutputError as e:
        raise HTTPException(502, {"message": "The AI assistant did not return a usable answer", "detail": str(e)}) from e


def _propose(db: Session, user: User, a, llm: LLM, kind: str, prompt: str, task: str, hint: str, extra: dict | None = None):
    g = _graph(a)
    base = (f"TASK:\n{task}\n\nCURRENT GRAPH:\n{fence(graph_summary(g))}\n\nCANDIDATE TECHNOLOGIES (use only these slugs):\n"
            f"{fence(candidates(db, hint))}\n\nJSON SCHEMA (omit empty fields):\n{OPS_SCHEMA}")
    proposal = _ai_call(llm, base, Proposal)
    applied = apply_proposal(db, g, proposal)
    if applied.errors:  # give the model one chance to fix concrete, explicit errors
        problems = "; ".join(e["message"] for e in applied.errors)[:800]
        proposal = _ai_call(llm, f"{base}\n\nYour previous proposal was rejected by validation: {problems}\nFix it.", Proposal)
        applied = apply_proposal(db, g, proposal)
    if applied.errors:
        raise HTTPException(422, {"message": "The AI proposal failed validation and was discarded", "errors": applied.errors})
    s = AISuggestion(architecture_id=a.id, user_id=user.id, kind=kind, prompt=prompt[:4000],
                     base_version=_latest(a).version_number, proposed_changes=proposal.model_dump(),
                     explanation=proposal.explanation)
    db.add(s); db.commit()
    facts = {}
    for op in proposal.operations:
        for slug in (getattr(op, "technology_id", None), getattr(getattr(op, "replacement", None), "technology_id", None)):
            if slug and (f := tech_facts(db, slug)):
                facts[slug] = f
    if extra:
        facts.update(extra)
    return {"id": s.id, "kind": kind, "status": "pending", "base_version": s.base_version, "ai_generated": True,
            "proposal": proposal.model_dump(), "diff": applied.diff, "preview_graph": applied.preview.model_dump(),
            "validation": applied.validation, "verified_facts": facts}


@router.post("/{arch_id}/ai/generate")
def generate(arch_id: str, body: PromptIn, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db), llm: LLM = Depends(get_llm)):
    a = _get_owned(db, user, arch_id)
    task = ("Design (or extend) the architecture for this project description. Use add_node/add_edge, and only change "
            f"existing nodes if clearly needed. Explain why each component was chosen and list assumptions.\n"
            f"PROJECT DESCRIPTION (from the user):\n{fence(clean(body.prompt, 2000))}")
    return _propose(db, user, a, llm, "generate", body.prompt, task, body.prompt)


@router.post("/{arch_id}/ai/alternatives")
def alternatives(arch_id: str, body: AltIn, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db), llm: LLM = Depends(get_llm)):
    a = _get_owned(db, user, arch_id)
    n = next((n for n in _graph(a).nodes if n.id == body.node_id and n.kind == "component"), None)
    if not n:
        raise HTTPException(404, "component not found in the latest version")
    q = clean(body.question, 1000) or "Suggest the best alternative"
    task = (f"Propose replacing component '{n.id}' ({n.technology}) with an alternative, using ONE replace_node operation that "
            f"preserves its useful connections. Fill `comparison` (functionality, compatibility, complexity, integration support, "
            f"documentation, maintenance, trade-offs) and `trade_offs`. Do not claim the alternative is objectively better.\n"
            f"USER QUESTION: {fence(q)}")
    extra = {n.technology: tech_facts(db, n.technology)} if n.technology else None
    return _propose(db, user, a, llm, "alternatives", q, task, f"{n.technology} {q}", extra)


@router.post("/{arch_id}/ai/optimize")
def optimize(arch_id: str, body: OptimizeIn, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db), llm: LLM = Depends(get_llm)):
    a = _get_owned(db, user, arch_id)
    note = clean(body.note, 1000)
    task = (f"Propose changes to optimise this architecture for: {body.objective.replace('_', ' ')}. Do not assume replacements "
            f"are objectively better; fill `trade_offs` honestly and keep changes minimal.\nEXTRA CONTEXT: {fence(note or 'none')}")
    return _propose(db, user, a, llm, "optimize", f"{body.objective}: {note}", task, f"{body.objective} {note}")


@router.post("/{arch_id}/ai/explain")
def explain(arch_id: str, body: ExplainIn, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db), llm: LLM = Depends(get_llm)):
    a = _get_owned(db, user, arch_id)
    g = _graph(a)
    target = None
    facts = {}
    if body.node_id:
        target = next((n for n in g.nodes if n.id == body.node_id), None)
        if not target:
            raise HTTPException(404, "node not found in the latest version")
        if target.technology and (f := tech_facts(db, target.technology)):
            facts[target.technology] = f
    elif body.edge_id:
        target = next((e for e in g.edges if e.id == body.edge_id), None)
        if not target:
            raise HTTPException(404, "edge not found in the latest version")
    q = clean(body.question, 1000) or "Explain what it does, why it is there, how it interacts with the rest, alternatives and trade-offs."
    user_msg = (f"TASK: Answer the question about the selected {'component' if body.node_id else 'connection' if body.edge_id else 'architecture'}. "
                f"Cover what it does, why it exists, interactions, alternatives and trade-offs. Distinguish what you know from assumptions.\n"
                f"SELECTED: {fence(target.model_dump() if target else 'whole architecture')}\nGRAPH:\n{fence(graph_summary(g))}\n"
                f"QUESTION: {fence(q)}\nJSON SCHEMA: {{\"answer\": \"markdown-free text\"}}")
    out = _ai_call(llm, user_msg, Explanation)
    return {"ai_generated": True, "answer": out.answer, "verified_facts": facts}


@router.post("/{arch_id}/ai/review")
def review(arch_id: str, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db), llm: LLM = Depends(get_llm)):
    a = _get_owned(db, user, arch_id)
    g = _graph(a)
    findings = [f.model_dump() for f in rule_review(db, g)]
    ai_error = None
    user_msg = ("TASK: Review this architecture. Check missing components, questionable connections, duplicate functionality, "
                "security, scalability, bottlenecks, unnecessary complexity, cost concerns and missing observability. "
                "Give each finding a severity (high|medium|low|info) and explanation. Do not repeat the obvious structural "
                f"checks already done by rules.\nGRAPH:\n{fence(graph_summary(g))}\n"
                'JSON SCHEMA: {"findings": [{"severity":"high|medium|low|info","category":"...","title":"...","explanation":"...","nodes":["<node id>"]}]}')
    valid_ids = {n.id for n in g.nodes}
    try:
        for f in _ai_call(llm, user_msg, AIReview).findings:
            d = f.model_dump()
            d["source"], d["nodes"] = "ai", [n for n in d["nodes"] if n in valid_ids]
            findings.append(d)
    except HTTPException as e:  # rules-only is still useful when the model is missing or fails
        ai_error = ("AI assistant is not configured; showing rule-based findings only" if e.status_code == 503
                    else str(e.detail)[:200])
    order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    findings.sort(key=lambda f: order[f["severity"]])
    return {"version": _latest(a).version_number, "findings": findings, "ai_error": ai_error,
            "note": "source=rule findings are deterministic checks; source=ai findings are model opinions to verify."}


@router.get("/{arch_id}/ai/suggestions")
def suggestions(arch_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _get_owned(db, user, arch_id)
    rows = db.scalars(select(AISuggestion).where(AISuggestion.architecture_id == arch_id).order_by(AISuggestion.created_at.desc()).limit(50))
    return [{"id": s.id, "kind": s.kind, "prompt": s.prompt, "status": s.status, "base_version": s.base_version,
             "summary": s.proposed_changes.get("summary"), "created_at": s.created_at} for s in rows]


def _suggestion(db: Session, user: User, arch_id: str, sid: str) -> AISuggestion:
    s = db.get(AISuggestion, sid)
    if not s or s.architecture_id != arch_id or s.user_id != user.id:
        raise HTTPException(404, "suggestion not found")
    return s


@router.post("/{arch_id}/ai/suggestions/{sid}/accept", status_code=201)
def accept(arch_id: str, sid: str, body: AcceptIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, arch_id)
    s = _suggestion(db, user, arch_id, sid)
    if s.status != "pending":
        raise HTTPException(409, f"suggestion already {s.status}")
    if s.base_version != _latest(a).version_number:
        raise HTTPException(409, "The architecture changed after this proposal was made. Generate a new proposal.")
    proposal = Proposal.model_validate(s.proposed_changes)
    if body.operation_indexes is not None and any(i < 0 or i >= len(proposal.operations) for i in body.operation_indexes):
        raise HTTPException(422, "operation index out of range")
    applied = apply_proposal(db, _graph(a), proposal, body.operation_indexes)
    if applied.errors:
        raise HTTPException(422, {"message": "The selected changes are not valid together", "errors": applied.errors})
    v = _add_version(db, a, applied.graph, f"AI: {proposal.summary}"[:300])
    s.status, s.resolved_at = "accepted", datetime.now(timezone.utc)
    db.commit()
    return {"version_number": v.version_number, "validation": applied.validation}


@router.post("/{arch_id}/ai/suggestions/{sid}/reject")
def reject(arch_id: str, sid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _get_owned(db, user, arch_id)
    s = _suggestion(db, user, arch_id, sid)
    if s.status != "pending":
        raise HTTPException(409, f"suggestion already {s.status}")
    s.status, s.resolved_at = "rejected", datetime.now(timezone.utc)
    db.commit()
    return {"status": "rejected"}


@router.post("/ai/compare")
def compare_endpoint(body: CompareIn, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    def load(r: Ref) -> Graph:
        a = _get_owned(db, user, r.id)
        v = a.versions[-1] if r.version is None else next((v for v in a.versions if v.version_number == r.version), None)
        if v is None:
            raise HTTPException(404, "version not found")
        return Graph.model_validate(v.graph_json)
    out = cmp.compare(db, load(body.a), load(body.b))
    out["ai_narrative"] = None
    if body.narrate:
        llm = get_llm()
        msg = ("TASK: Compare two architecture variants A and B using the facts below (computed by the system). Discuss complexity, "
               "maintenance, scalability, deployment and cost ASSUMPTIONS and technology trade-offs. State assumptions; do not invent numbers.\n"
               f"FACTS: {fence(out)}\nJSON SCHEMA: {{\"narrative\": \"...\", \"assumptions\": [\"...\"]}}")
        out["ai_narrative"] = _ai_call(llm, msg, Narrative).model_dump()
    return out
