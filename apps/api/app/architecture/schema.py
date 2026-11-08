from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.architecture.rules import COMPONENT_TYPES, CONNECTION_TYPES


class Position(BaseModel):
    x: float
    y: float


class NodeData(BaseModel):
    label: str = Field(max_length=120)
    notes: str = Field("", max_length=4000)
    layer: str | None = Field(None, max_length=60)
    component_type: str | None = None
    config: dict = Field(default_factory=dict)

    @field_validator("component_type")
    @classmethod
    def _ct(cls, v):
        if v is not None and v not in COMPONENT_TYPES:
            raise ValueError(f"unknown component_type '{v}'")
        return v


class Node(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    kind: Literal["component", "group", "note"] = "component"
    technology: str | None = Field(None, max_length=200, description="technology slug (components only)")
    position: Position
    parent: str | None = None
    width: float | None = None
    height: float | None = None
    data: NodeData


class Edge(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    source: str
    target: str
    connection_type: str = "custom"
    label: str = Field("", max_length=120)
    notes: str = Field("", max_length=2000)

    @field_validator("connection_type")
    @classmethod
    def _c(cls, v):
        if v not in CONNECTION_TYPES:
            raise ValueError(f"unknown connection_type '{v}'")
        return v


class Graph(BaseModel):
    nodes: list[Node] = Field(default_factory=list, max_length=300)
    edges: list[Edge] = Field(default_factory=list, max_length=600)
