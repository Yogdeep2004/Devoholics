from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes import optional_user_id
from app.architecture.rules import CONNECTION_TYPES, component_type_for
from app.architecture.schema import Graph
from app.architecture.validation import validate_graph
from app.core.auth import current_user
from app.db import get_db
from app.models import (
    Architecture,
    ArchitectureVersion,
    Category,
    Collection,
    Repository,
    Technology,
    User,
)
from app.seed import FEATURED_COMPONENTS

router = APIRouter(prefix="/api/v1", tags=["architecture"])


class ArchIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    collection_id: str | None = None
    graph: Graph = Field(default_factory=Graph)


class ArchPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    visibility: str | None = Field(None, pattern="^(private|public)$")
    collection_id: str | None = None


class VersionIn(BaseModel):
    graph: Graph
    note: str | None = Field(None, max_length=300)


class CollectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


# ---- component library (reads the central technology table; no separate catalogue) ----
@router.get("/components")
def components(q: str | None = None, slug: str | None = None, component_type: str | None = None, featured: bool = False,
               limit: int = 100, db: Session = Depends(get_db)):
    stmt = select(Technology).join(Category).outerjoin(Repository).order_by(Repository.stars.desc().nulls_last())
    if featured:
        stmt = stmt.where(Technology.slug.in_(FEATURED_COMPONENTS))
    if slug:
        stmt = stmt.where(Technology.slug == slug)
    if q:
        stmt = stmt.where(func.lower(Technology.name).like(f"%{q.lower()}%"))
    out = []
    for t in db.scalars(stmt.limit(min(limit, 300))).unique():
        ct = component_type_for(t.category.slug)
        if component_type and ct != component_type:
            continue
        repo = t.repositories[0] if t.repositories else None
        out.append({"slug": t.slug, "name": t.name, "category": t.category.slug, "component_type": ct,
                    "description": t.description, "license": t.license, "stars": repo.stars if repo else None,
                    "official_url": t.official_url, "documentation_url": t.documentation_url,
                    "repository_url": repo.repository_url if repo else None})
    return out


@router.get("/connection-types")
def connection_types():
    return sorted(CONNECTION_TYPES)


# ---- helpers ----
def _latest(a: Architecture) -> ArchitectureVersion:
    return a.versions[-1]


def _get_owned(db: Session, user: User, arch_id: str) -> Architecture:
    a = db.get(Architecture, arch_id)
    if not a or a.user_id != user.id:  # 404, not 403: don't reveal that others' private designs exist
        raise HTTPException(404, "architecture not found")
    return a


def _meta(a: Architecture) -> dict:
    return {"id": a.id, "title": a.title, "description": a.description, "visibility": a.visibility,
            "collection_id": a.collection_id, "forked_from_id": a.forked_from_id, "updated_at": a.updated_at,
            "latest_version": _latest(a).version_number if a.versions else 0}


def _checked(db: Session, g: Graph):
    rep = validate_graph(db, g)
    if rep.errors:
        raise HTTPException(422, {"message": "graph failed validation", "report": rep.to_dict()})
    return rep


def _add_version(db: Session, a: Architecture, g: Graph, note: str | None) -> ArchitectureVersion:
    n = (db.scalar(select(func.max(ArchitectureVersion.version_number)).where(ArchitectureVersion.architecture_id == a.id)) or 0) + 1
    v = ArchitectureVersion(architecture_id=a.id, version_number=n, graph_json=g.model_dump(), note=note)
    a.versions.append(v)
    return v


def _check_collection(db: Session, user: User, cid: str | None):
    if cid is None:
        return
    c = db.get(Collection, cid)
    if c is None or c.user_id != user.id:
        raise HTTPException(404, "collection not found")


# ---- architectures ----
@router.post("/architectures/validate")
def validate(g: Graph, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return validate_graph(db, g).to_dict()


@router.post("/architectures", status_code=201)
def create(body: ArchIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _check_collection(db, user, body.collection_id)
    _checked(db, body.graph)
    a = Architecture(user_id=user.id, title=body.title, description=body.description, collection_id=body.collection_id)
    db.add(a); db.flush()
    _add_version(db, a, body.graph, "Initial version")
    db.commit()
    return _meta(a)


@router.get("/architectures")
def mine(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Architecture).where(Architecture.user_id == user.id).order_by(Architecture.updated_at.desc()))
    return [_meta(a) for a in rows]


@router.get("/architectures/{arch_id}")
def read(arch_id: str, db: Session = Depends(get_db), viewer: str | None = Depends(optional_user_id)):
    a = db.get(Architecture, arch_id)
    if not a or (a.visibility != "public" and a.user_id != viewer):
        raise HTTPException(404, "architecture not found")
    v = _latest(a)
    return {**_meta(a), "owner": a.user_id == viewer, "graph": v.graph_json, "version_note": v.note,
            "validation": validate_graph(db, Graph.model_validate(v.graph_json)).to_dict()}


@router.patch("/architectures/{arch_id}")
def patch(arch_id: str, body: ArchPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, arch_id)
    data = body.model_dump(exclude_unset=True)
    if "collection_id" in data:
        _check_collection(db, user, data["collection_id"])
    for k, v in data.items():
        setattr(a, k, v)
    db.commit()
    return _meta(a)


@router.delete("/architectures/{arch_id}", status_code=204)
def delete(arch_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_get_owned(db, user, arch_id)); db.commit()


@router.post("/architectures/{arch_id}/versions", status_code=201)
def save_version(arch_id: str, body: VersionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, arch_id)
    rep = _checked(db, body.graph)
    v = _add_version(db, a, body.graph, body.note)
    db.commit()
    return {"version_number": v.version_number, "validation": rep.to_dict()}


@router.get("/architectures/{arch_id}/versions")
def versions(arch_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, arch_id)
    return [{"version_number": v.version_number, "note": v.note, "created_at": v.created_at,
             "nodes": len(v.graph_json.get("nodes", [])), "edges": len(v.graph_json.get("edges", []))}
            for v in reversed(a.versions)]


@router.get("/architectures/{arch_id}/versions/{n}")
def version(arch_id: str, n: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, arch_id)
    v = next((v for v in a.versions if v.version_number == n), None)
    if not v:
        raise HTTPException(404, "version not found")
    return {"version_number": n, "note": v.note, "graph": v.graph_json}


@router.post("/architectures/{arch_id}/restore/{n}", status_code=201)
def restore(arch_id: str, n: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Restoring never destroys history: it appends a new version copying the old graph."""
    a = _get_owned(db, user, arch_id)
    old = next((v for v in a.versions if v.version_number == n), None)
    if not old:
        raise HTTPException(404, "version not found")
    v = _add_version(db, a, Graph.model_validate(old.graph_json), f"Restored from v{n}")
    db.commit()
    return {"version_number": v.version_number}


@router.post("/architectures/{arch_id}/duplicate", status_code=201)
def duplicate(arch_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get_owned(db, user, arch_id)
    c = Architecture(user_id=user.id, title=f"{a.title} (copy)", description=a.description,
                     collection_id=a.collection_id, forked_from_id=a.id)
    db.add(c); db.flush()
    _add_version(db, c, Graph.model_validate(_latest(a).graph_json), f"Duplicated from '{a.title}'")
    db.commit()
    return _meta(c)


# ---- collections ----
@router.get("/collections")
def collections(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{"id": c.id, "name": c.name} for c in db.scalars(select(Collection).where(Collection.user_id == user.id))]


@router.post("/collections", status_code=201)
def create_collection(body: CollectionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = Collection(user_id=user.id, name=body.name); db.add(c); db.commit()
    return {"id": c.id, "name": c.name}


@router.delete("/collections/{cid}", status_code=204)
def delete_collection(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(Collection, cid)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "collection not found")
    db.delete(c); db.commit()
