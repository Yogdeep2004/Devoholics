import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _url(u: str) -> str:
    return u.replace("postgresql://", "postgresql+psycopg://", 1) if u.startswith("postgresql://") else u


class Base(DeclarativeBase):
    pass


_url_ = _url(settings.database_url)
_postgres = _url_.startswith("postgresql")
_serverless = bool(os.getenv("VERCEL"))

engine = create_engine(
    _url_,
    pool_pre_ping=not _serverless,
    # Serverless functions are short-lived and many run at once: let Supabase's pooler do the pooling (NullPool here),
    # and turn off prepared statements, which the transaction pooler (port 6543) does not support.
    **({"poolclass": NullPool} if _serverless else {}),
    **({"connect_args": {"prepare_threshold": None}} if _postgres else {}),
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as session:
        yield session
