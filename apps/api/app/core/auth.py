"""Verify Supabase-issued JWTs server-side (ES256 via the project's JWKS)."""
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import User


@dataclass
class Claims:
    sub: str
    email: str


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True)


def decode_token(token: str) -> Claims:
    try:
        key = _jwks().get_signing_key_from_jwt(token).key
        d = jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated",
                       issuer=f"{settings.supabase_url}/auth/v1")
    except Exception as e:
        raise HTTPException(401, "invalid or expired token") from e
    return Claims(sub=d["sub"], email=d.get("email", ""))


def current_user(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    c = decode_token(authorization[7:])
    user = db.get(User, c.sub)
    if not user:  # first authenticated request creates the profile
        user = User(id=c.sub, email=c.email)
        db.add(user); db.commit()
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "moderator access required")
    return user
