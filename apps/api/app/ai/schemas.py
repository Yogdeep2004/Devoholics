from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from app.architecture.rules import CONNECTION_TYPES

Id = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")]
Reason = Annotated[str, Field(max_length=500)]


class AddNode(BaseModel):
    action: Literal["add_node"]
    ref: Id  # temporary key so later operations can point at this new node
    technology_id: str = Field(max_length=200, description="technology slug from the candidate list")
    label: str | None = Field(None, max_length=120)
    layer: str | None = Field(None, max_length=60)
    reason: Reason = ""


class RemoveNode(BaseModel):
    action: Literal["remove_node"]
    target_node: Id
    reason: Reason = ""


class Replacement(BaseModel):
    technology_id: str = Field(max_length=200)
    reason: Reason = ""


class ReplaceNode(BaseModel):
    action: Literal["replace_node"]
    target_node: Id
    replacement: Replacement
    connections_to_preserve: list[Id] | None = None  # neighbour node ids; None keeps all
    reason: Reason = ""


class UpdateNode(BaseModel):
    action: Literal["update_node"]
    target_node: Id
    label: str | None = Field(None, max_length=120)
    notes: str | None = Field(None, max_length=4000)
    layer: str | None = Field(None, max_length=60)
    reason: Reason = ""


class AddEdge(BaseModel):
    action: Literal["add_edge"]
    source: Id  # existing node id, or the ref of a node added in this proposal
    target: Id
    connection_type: str = "custom"
    label: str = Field("", max_length=120)
    reason: Reason = ""

    @field_validator("connection_type")
    @classmethod
    def _c(cls, v):
        if v not in CONNECTION_TYPES:
            raise ValueError(f"unknown connection_type '{v}'")
        return v


class RemoveEdge(BaseModel):
    action: Literal["remove_edge"]
    edge_id: Id
    reason: Reason = ""


Operation = Annotated[AddNode | RemoveNode | ReplaceNode | UpdateNode | AddEdge | RemoveEdge, Field(discriminator="action")]


class ComparisonRow(BaseModel):
    criterion: str = Field(max_length=100)
    current: str = Field(max_length=400)
    alternative: str = Field(max_length=400)


class Proposal(BaseModel):
    summary: str = Field(max_length=400)
    explanation: str = Field("", max_length=4000)
    assumptions: list[str] = Field(default_factory=list, max_length=15)
    trade_offs: list[str] = Field(default_factory=list, max_length=15)
    comparison: list[ComparisonRow] = Field(default_factory=list, max_length=15)
    operations: list[Operation] = Field(default_factory=list, max_length=40)


class Finding(BaseModel):
    severity: Literal["high", "medium", "low", "info"]
    category: str = Field(max_length=60)
    title: str = Field(max_length=160)
    explanation: str = Field(max_length=1200)
    nodes: list[str] = Field(default_factory=list, max_length=20)
    source: Literal["rule", "ai"] = "ai"


class AIReview(BaseModel):
    findings: list[Finding] = Field(default_factory=list, max_length=25)


Objective = Literal["reduce_cost", "improve_scalability", "reduce_complexity", "prefer_open_source",
                    "prefer_self_hosted", "improve_maintainability"]
