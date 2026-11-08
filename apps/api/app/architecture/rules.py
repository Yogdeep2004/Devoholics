"""Component taxonomy and structural connection rules.

These rules describe *common structural patterns* between component types. They are NOT claims that two
specific products integrate; only a verified TechnologyRelationship upgrades an edge to "verified".
"""
CATEGORY_TO_COMPONENT_TYPE = {
    "llm-inference": "llm", "models": "llm", "agent-frameworks": "agent", "rag": "orchestrator",
    "vector-databases": "vector_database", "mcp": "mcp_server", "frontend": "frontend", "backend": "backend",
    "databases": "database", "infrastructure": "infrastructure", "observability": "monitoring",
    "dev-tools": "external_service", "ai-coding": "external_service",
}
COMPONENT_TYPES = {"frontend", "backend", "api", "llm", "agent", "orchestrator", "database", "vector_database",
                   "storage", "mcp_server", "external_service", "infrastructure", "monitoring"}
CONNECTION_TYPES = {"http_api", "database_connection", "llm_inference", "embedding_generation", "retrieval",
                    "tool_invocation", "mcp_communication", "event_streaming", "authentication",
                    "data_ingestion", "custom"}

_R: dict[tuple[str, str], set[str]] = {}


def _rule(srcs, tgts, conns):
    for s in srcs.split():
        for t in tgts.split():
            _R.setdefault((s, t), set()).update(conns.split())


_rule("frontend", "backend api", "http_api authentication")
_rule("backend api", "backend api external_service", "http_api authentication")
_rule("backend orchestrator agent", "database storage", "database_connection data_ingestion")
_rule("backend orchestrator agent", "vector_database", "retrieval data_ingestion database_connection")
_rule("backend orchestrator agent", "llm", "llm_inference embedding_generation")
_rule("backend", "agent orchestrator", "http_api tool_invocation")
_rule("backend orchestrator agent", "mcp_server", "mcp_communication tool_invocation")
_rule("orchestrator", "agent", "tool_invocation")
_rule("agent", "agent", "tool_invocation")
_rule("agent orchestrator", "external_service", "tool_invocation http_api")
_rule("external_service", "backend orchestrator agent", "data_ingestion http_api")
_rule("frontend backend api agent orchestrator database vector_database storage llm mcp_server "
      "external_service infrastructure", "monitoring", "event_streaming http_api")
_rule("backend infrastructure", "backend infrastructure", "event_streaming")


def rule_allows(src_type: str, tgt_type: str, conn: str) -> bool:
    return conn in _R.get((src_type, tgt_type), set())


def component_type_for(category_slug: str) -> str:
    return CATEGORY_TO_COMPONENT_TYPE.get(category_slug, "external_service")
