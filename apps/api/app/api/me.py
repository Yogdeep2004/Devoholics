from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.routes import _tech_summary
from app.core.auth import current_user
from app.db import get_db
from app.models import Bookmark, Category, Technology, User, UserFollow, UserInterest

router = APIRouter(prefix="/api/v1/me", tags=["me"])


class ProfileIn(BaseModel):
    username: str | None = Field(None, min_length=2, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    avatar_url: str | None = Field(None, max_length=500)


class InterestsIn(BaseModel):
    categories: list[str] = Field(max_length=20)


def _tech(db: Session, slug: str) -> Technology:
    t = db.scalar(select(Technology).where(Technology.slug == slug))
    if not t:
        raise HTTPException(404, "technology not found")
    return t


@router.get("")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    cats = db.scalars(select(Category.slug).join(UserInterest).where(UserInterest.user_id == user.id)).all()
    return {"id": user.id, "email": user.email, "username": user.username, "avatar_url": user.avatar_url, "interests": cats}


@router.patch("")
def update_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.username and db.scalar(select(User.id).where(User.username == body.username, User.id != user.id)):
        raise HTTPException(409, "username taken")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    return {"ok": True}


@router.put("/interests")
def set_interests(body: InterestsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cats = db.scalars(select(Category).where(Category.slug.in_(body.categories))).all()
    if len(cats) != len(set(body.categories)):
        raise HTTPException(422, "unknown category")
    db.execute(delete(UserInterest).where(UserInterest.user_id == user.id))
    db.add_all(UserInterest(user_id=user.id, category_id=c.id) for c in cats)
    db.commit()
    return {"interests": [c.slug for c in cats]}


def _toggle(model, name):
    def put(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
        t = _tech(db, slug)
        if not db.scalar(select(model.id).where(model.user_id == user.id, model.technology_id == t.id)):
            db.add(model(user_id=user.id, technology_id=t.id)); db.commit()
        return {name: True}

    def remove(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
        t = _tech(db, slug)
        db.execute(delete(model).where(model.user_id == user.id, model.technology_id == t.id)); db.commit()
        return {name: False}
    return put, remove


for _model, _path, _name in ((Bookmark, "bookmarks", "bookmarked"), (UserFollow, "follows", "following")):
    _put, _del = _toggle(_model, _name)
    router.add_api_route(f"/{_path}/{{slug}}", _put, methods=["PUT"])
    router.add_api_route(f"/{_path}/{{slug}}", _del, methods=["DELETE"])


@router.get("/library")
def library(user: User = Depends(current_user), db: Session = Depends(get_db)):
    def techs(model):
        q = select(Technology).join(model, model.technology_id == Technology.id).where(model.user_id == user.id)
        return [_tech_summary(t) for t in db.scalars(q).unique()]
    return {"bookmarks": techs(Bookmark), "follows": techs(UserFollow)}
