import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

JsonType = JSON().with_variant(__import__("sqlalchemy.dialects.postgresql", fromlist=["JSONB"]).JSONB(), "postgresql")


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class Technology(Base):
    __tablename__ = "technologies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    official_url: Mapped[str | None] = mapped_column(String(500))
    documentation_url: Mapped[str | None] = mapped_column(String(500))
    license: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    category: Mapped[Category] = relationship()
    repositories: Mapped[list["Repository"]] = relationship(back_populates="technology")


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (UniqueConstraint("source_platform", "external_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id"), index=True)
    source_platform: Mapped[str] = mapped_column(String(30))
    external_id: Mapped[str] = mapped_column(String(200))
    repository_url: Mapped[str] = mapped_column(String(500))
    stars: Mapped[int | None] = mapped_column(BigInteger)
    forks: Mapped[int | None] = mapped_column(BigInteger)
    open_issues: Mapped[int | None] = mapped_column(BigInteger)
    last_commit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    platform_metadata: Mapped[dict | None] = mapped_column(JsonType)  # e.g. HF downloads, MCP registry info
    technology: Mapped[Technology] = relationship(back_populates="repositories")


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"
    __table_args__ = (Index("ix_snapshots_repo_time", "repository_id", "recorded_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"))
    stars: Mapped[int | None] = mapped_column(BigInteger)
    forks: Mapped[int | None] = mapped_column(BigInteger)
    open_issues: Mapped[int | None] = mapped_column(BigInteger)
    contributors: Mapped[int | None] = mapped_column(BigInteger)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Release(Base):
    __tablename__ = "releases"
    __table_args__ = (UniqueConstraint("repository_id", "version"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    version: Mapped[str] = mapped_column(String(200))
    release_url: Mapped[str | None] = mapped_column(String(500))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TechnologyRelationship(Base):
    __tablename__ = "technology_relationships"
    __table_args__ = (UniqueConstraint("source_technology_id", "target_technology_id", "relationship_type"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    source_technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id"))
    target_technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id"))
    relationship_type: Mapped[str] = mapped_column(String(50))
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    verification_status: Mapped[str] = mapped_column(String(20), default="unverified")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FeedEvent(Base):
    __tablename__ = "feed_events"
    __table_args__ = (Index("ix_feed_detected", "detected_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    event_title: Mapped[str] = mapped_column(String(300))
    event_description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(500))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JsonType)


class User(Base):
    """App profile; id mirrors Supabase auth.users.id (UUID string)."""

    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    username: Mapped[str | None] = mapped_column(String(50), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserFollow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (UniqueConstraint("user_id", "technology_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "technology_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Package(Base):
    __tablename__ = "packages"
    __table_args__ = (UniqueConstraint("registry", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    technology_id: Mapped[int] = mapped_column(ForeignKey("technologies.id", ondelete="CASCADE"), index=True)
    registry_name: Mapped[str] = mapped_column("registry", String(20))  # npm | pypi
    name: Mapped[str] = mapped_column(String(200))
    latest_version: Mapped[str | None] = mapped_column(String(100))
    latest_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    weekly_downloads: Mapped[int | None] = mapped_column(BigInteger)
    dependency_count: Mapped[int | None] = mapped_column(BigInteger)
    package_url: Mapped[str | None] = mapped_column(String(500))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserInterest(Base):
    __tablename__ = "user_interests"
    __table_args__ = (UniqueConstraint("user_id", "category_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))


def _uuid() -> str:
    return str(uuid.uuid4())


class Collection(Base):
    __tablename__ = "collections"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Architecture(Base):
    __tablename__ = "architectures"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    collection_id: Mapped[str | None] = mapped_column(ForeignKey("collections.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(10), default="private")  # private | public
    forked_from_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    versions: Mapped[list["ArchitectureVersion"]] = relationship(
        back_populates="architecture", order_by="ArchitectureVersion.version_number", cascade="all, delete-orphan")


class ArchitectureVersion(Base):
    __tablename__ = "architecture_versions"
    __table_args__ = (UniqueConstraint("architecture_id", "version_number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    architecture_id: Mapped[str] = mapped_column(ForeignKey("architectures.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int]
    graph_json: Mapped[dict] = mapped_column(JsonType)
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    architecture: Mapped[Architecture] = relationship(back_populates="versions")
