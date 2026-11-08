from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Architecture


def tech_usage(db: Session, user_id: str) -> dict[str, list[dict]]:
    """technology slug -> [{architecture_id, title, node_id}] from the latest version of each of the user's designs."""
    out: dict[str, list[dict]] = {}
    for a in db.scalars(select(Architecture).where(Architecture.user_id == user_id)):
        if not a.versions:
            continue
        for n in a.versions[-1].graph_json.get("nodes", []):
            if n.get("kind") == "component" and n.get("technology"):
                out.setdefault(n["technology"], []).append({"architecture_id": a.id, "title": a.title, "node_id": n["id"]})
    return out
