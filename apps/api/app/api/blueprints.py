import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.ai.context import tech_facts
from app.api.architectures import _add_version, _get_owned, _latest
from app.api.routes import optional_user_id
from app.architecture.schema import Graph
from app.architecture.validation import normalize_graph, validate_graph
from app.core.auth import admin_user, current_user
from app.db import get_db
from app.models import Architecture, Blueprint, BlueprintReport, BlueprintVersion, User

router = APIRouter(prefix="/api/v1", tags=["blueprints"])

MAX_PENDING_PER_USER = 5
Reason = Literal["spam", "inappropriate", "inaccurate", "copyright", "other"]


class FlowNote(BaseModel):
    source: str = Field(max_length=120, alias="from")
    target: str = Field(max_length=120, alias="to")
    explanation: str = Field(max_length=600)
    model_config = {"populate_by_name": True}


class BlueprintIn(BaseModel):
    architecture_id: str
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=20, max_length=3000)
    difficulty: Literal["beginner", "intermediate", "advanced"]
    data_flows: list[str] = Field(default_factory=list, max_length=15)
    integration_notes: list[FlowNote] = Field(default_factory=list, max_length=20)
    infrastructure_notes: str | None = Field(None, max_length=2000)
    known_limitations: list[str] = Field(default_factory=list, max_length=15)


class NewVersionIn(BaseModel):
    architecture_id: str
    changelog: str | None = Field(None, max_length=500)


class ReportIn(BaseModel):
    reason: Reason
    details: str | None = Field(None, max_length=1000)


class ModerationIn(BaseModel):
    note: str | None = Field(None, max_length=1000)


class ResolveIn(BaseModel):
    action: Literal["dismiss", "remove_blueprint"]
    note: str | None = Field(None, max_length=1000)


def _slug(db: Session, title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:90] or "blueprint"
    slug, k = base, 1
    while db.scalar(select(Blueprint.id).where(Blueprint.slug == slug)):
        k += 1; slug = f"{base}-{k}"
    return slug


def _spammy(*texts: str | None) -> bool:
    return sum(len(re.findall(r"https?://", t or "")) for t in texts) > 3


def _bp_by_slug(db: Session, slug: str) -> Blueprint:
    bp = db.scalar(select(Blueprint).where(Blueprint.slug == slug))
    if not bp:
        raise HTTPException(404, "blueprint not found")
    return bp


def _visible(bp: Blueprint, viewer: str | None, admin: bool = False) -> bool:
    return bp.status == "published" or (viewer is not None and bp.author_id == viewer) or admin


def _card(bp: Blueprint) -> dict:
    g = bp.versions[-1].graph_json
    comps = [n for n in g["nodes"] if n["kind"] == "component"]
    return {"slug": bp.slug, "title": bp.title, "description": bp.description[:240], "difficulty": bp.difficulty,
            "status": bp.status, "curated": bp.curated, "version": bp.version, "fork_count": bp.fork_count,
            "components": len(comps), "technologies": sorted({n["technology"] for n in comps if n.get("technology")}),
            "author": {"id": bp.author_id, "username": bp.author.username or "anonymous"},
            "published_at": bp.published_at,
            "thumb": {"nodes": [{"x": n["position"]["x"], "y": n["position"]["y"], "t": (n.get("data") or {}).get("component_type")} for n in comps],
                      "edges": [[e["source"], e["target"]] for e in g["edges"]],
                      "ids": [n["id"] for n in comps]}}


def _snapshot(db: Session, a: Architecture) -> Graph:
    g = normalize_graph(db, Graph.model_validate(_latest(a).graph_json))
    comps = [n for n in g.nodes if n.kind == "component"]
    if len(comps) < 2:
        raise HTTPException(422, "A blueprint needs at least two components")
    rep = validate_graph(db, g)
    if rep.errors:
        raise HTTPException(422, {"message": "The architecture has validation errors", "errors": [i.__dict__ for i in rep.errors]})
    return g


@router.get("/blueprints")
def list_blueprints(q: str | None = None, difficulty: str | None = Query(None, pattern="^(beginner|intermediate|advanced)$"),
                    sort: str = Query("popular", pattern="^(popular|new)$"), limit: int = Query(50, ge=1, le=100),
                    db: Session = Depends(get_db)):
    stmt = select(Blueprint).where(Blueprint.status == "published")
    if difficulty:
        stmt = stmt.where(Blueprint.difficulty == difficulty)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Blueprint.title).like(like), func.lower(Blueprint.description).like(like)))
    stmt = stmt.order_by(Blueprint.curated.desc(), Blueprint.fork_count.desc() if sort == "popular" else Blueprint.published_at.desc())
    return [_card(b) for b in db.scalars(stmt.limit(limit))]


@router.get("/blueprints/mine")
def my_blueprints(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Blueprint).where(Blueprint.author_id == user.id).order_by(Blueprint.created_at.desc()))
    return [{**_card(b), "moderation_note": b.moderation_note} for b in rows]


@router.get("/blueprints/{slug}")
def read_blueprint(slug: str, db: Session = Depends(get_db), viewer: str | None = Depends(optional_user_id)):
    bp = _bp_by_slug(db, slug)
    is_admin = bool(viewer and (u := db.get(User, viewer)) and u.is_admin)
    if not _visible(bp, viewer, is_admin):
        raise HTTPException(404, "blueprint not found")
    v = bp.versions[-1]
    g = Graph.model_validate(v.graph_json)
    comps = []
    for n in g.nodes:
        if n.kind == "component" and n.technology and (f := tech_facts(db, n.technology)):
            comps.append({"node_id": n.id, "label": n.data.label, "layer": n.data.layer, **f})
    return {**_card(bp), "graph": v.graph_json, "changelog": v.changelog, "data_flows": bp.data_flows,
            "integration_notes": bp.integration_notes, "infrastructure_notes": bp.infrastructure_notes,
            "known_limitations": bp.known_limitations, "component_facts": comps,
            "validation": validate_graph(db, g).to_dict(), "is_author": viewer == bp.author_id,
            "moderation_note": bp.moderation_note if viewer == bp.author_id or is_admin else None,
            "versions": [{"version": x.version, "changelog": x.changelog, "created_at": x.created_at} for x in reversed(bp.versions)],
            "notice": None if bp.curated else "Community-submitted. DEVOHOLICS has reviewed it for policy, not for technical correctness."}


@router.post("/blueprints", status_code=201)
def submit(body: BlueprintIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, body.architecture_id)
    if _spammy(body.title, body.description, body.infrastructure_notes, *body.data_flows, *body.known_limitations):
        raise HTTPException(422, "Too many links; blueprints must describe the design, not advertise")
    pending = db.scalar(select(func.count(Blueprint.id)).where(Blueprint.author_id == user.id, Blueprint.status == "pending"))
    if pending >= MAX_PENDING_PER_USER:
        raise HTTPException(429, f"You already have {pending} blueprints awaiting review")
    g = _snapshot(db, a)
    bp = Blueprint(slug=_slug(db, body.title), author_id=user.id, title=body.title, description=body.description,
                   difficulty=body.difficulty, data_flows=body.data_flows,
                   integration_notes=[n.model_dump(by_alias=True) for n in body.integration_notes],
                   infrastructure_notes=body.infrastructure_notes, known_limitations=body.known_limitations, status="pending")
    bp.versions.append(BlueprintVersion(version=1, graph_json=g.model_dump(), changelog="Initial version"))
    db.add(bp); db.commit()
    return {"slug": bp.slug, "status": bp.status}


@router.post("/blueprints/{slug}/versions", status_code=201)
def new_version(slug: str, body: NewVersionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Authors publish updates as new immutable versions; community blueprints return to review first."""
    bp = _bp_by_slug(db, slug)
    if bp.author_id != user.id or bp.status == "removed":
        raise HTTPException(404, "blueprint not found")
    g = _snapshot(db, _get_owned(db, user, body.architecture_id))
    bp.version += 1
    bp.versions.append(BlueprintVersion(version=bp.version, graph_json=g.model_dump(), changelog=body.changelog))
    if not bp.curated:
        bp.status, bp.moderation_note = "pending", None
    db.commit()
    return {"version": bp.version, "status": bp.status}


@router.post("/blueprints/{slug}/fork", status_code=201)
def fork(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    bp = _bp_by_slug(db, slug)
    if bp.status != "published":
        raise HTTPException(404, "blueprint not found")
    a = Architecture(user_id=user.id, title=f"{bp.title} (fork)", description=bp.description[:2000],
                     forked_from_blueprint_id=bp.id)
    db.add(a); db.flush()
    _add_version(db, a, Graph.model_validate(bp.versions[-1].graph_json), f"Forked from blueprint '{bp.title}' v{bp.version}")
    bp.fork_count += 1
    db.commit()
    return {"architecture_id": a.id, "title": a.title}


@router.post("/blueprints/{slug}/report", status_code=201)
def report(slug: str, body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    bp = _bp_by_slug(db, slug)
    if bp.status != "published":
        raise HTTPException(404, "blueprint not found")
    if bp.author_id == user.id:
        raise HTTPException(422, "You can't report your own blueprint")
    if db.scalar(select(BlueprintReport.id).where(BlueprintReport.blueprint_id == bp.id, BlueprintReport.reporter_id == user.id)):
        raise HTTPException(409, "You already reported this blueprint")
    db.add(BlueprintReport(blueprint_id=bp.id, reporter_id=user.id, reason=body.reason, details=body.details))
    db.commit()
    return {"status": "reported"}


# ---- public architectures ----
@router.post("/architectures/{arch_id}/fork", status_code=201)
def fork_public_architecture(arch_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    src = db.get(Architecture, arch_id)
    if not src or (src.visibility != "public" and src.user_id != user.id):
        raise HTTPException(404, "architecture not found")
    a = Architecture(user_id=user.id, title=f"{src.title} (fork)", description=src.description, forked_from_id=src.id)
    db.add(a); db.flush()
    _add_version(db, a, Graph.model_validate(_latest(src).graph_json), f"Forked from '{src.title}'")
    db.commit()
    return {"architecture_id": a.id, "title": a.title}


# ---- moderation ----
@router.get("/admin/blueprints")
def admin_queue(status: str = Query("pending", pattern="^(pending|published|rejected|removed)$"),
                admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Blueprint).where(Blueprint.status == status).order_by(Blueprint.created_at))
    return [_card(b) for b in rows]


def _decide(db: Session, admin: User, slug: str, status: str, note: str | None):
    bp = _bp_by_slug(db, slug)
    if bp.status not in ("pending", "published"):
        raise HTTPException(409, f"blueprint is {bp.status}")
    bp.status, bp.moderation_note = status, note
    if status == "published":
        bp.published_at = bp.published_at or datetime.now(timezone.utc)
    db.commit()
    return {"slug": slug, "status": status}


@router.post("/admin/blueprints/{slug}/approve")
def approve(slug: str, body: ModerationIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return _decide(db, admin, slug, "published", body.note)


@router.post("/admin/blueprints/{slug}/reject")
def reject(slug: str, body: ModerationIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    if not (body.note or "").strip():
        raise HTTPException(422, "A rejection needs a note so the author knows what to fix")
    return _decide(db, admin, slug, "rejected", body.note)


@router.get("/admin/reports")
def admin_reports(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.execute(select(BlueprintReport, Blueprint).join(Blueprint).where(BlueprintReport.status == "open")
                      .order_by(BlueprintReport.created_at)).all()
    return [{"id": r.id, "reason": r.reason, "details": r.details, "created_at": r.created_at,
             "blueprint": {"slug": b.slug, "title": b.title, "status": b.status}} for r, b in rows]


@router.post("/admin/reports/{rid}/resolve")
def resolve(rid: str, body: ResolveIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    r = db.get(BlueprintReport, rid)
    if not r or r.status != "open":
        raise HTTPException(404, "open report not found")
    bp = db.get(Blueprint, r.blueprint_id)
    now = datetime.now(timezone.utc)
    if body.action == "remove_blueprint":
        if bp.curated:
            raise HTTPException(422, "Curated blueprints are edited, not removed, through reports")
        bp.status, bp.moderation_note = "removed", body.note or f"Removed after report ({r.reason})"
        for other in db.scalars(select(BlueprintReport).where(BlueprintReport.blueprint_id == bp.id, BlueprintReport.status == "open")):
            other.status, other.resolved_at, other.resolved_by = "actioned", now, admin.id
    else:
        r.status, r.resolved_at, r.resolved_by = "dismissed", now, admin.id
    db.commit()
    return {"status": r.status}
