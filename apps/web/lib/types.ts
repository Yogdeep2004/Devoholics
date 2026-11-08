export type Freshness = { last_synced_at: string | null; status: "fresh" | "stale" | "never" };
export type TechSummary = {
  slug: string; name: string; description: string | null; category: string; license: string | null;
  official_url: string | null; stars: number | null; forks: number | null;
  repository_url: string | null; freshness: Freshness;
};
export type Signal = { name: string; value: number | string | boolean | null; note: string | null };
export type TechProfile = TechSummary & {
  documentation_url: string | null; source_platform: string | null;
  platform_metadata: Record<string, unknown> | null;
  latest_release: { version: string; url: string | null; published_at: string | null } | null;
  packages: { registry: string; name: string; version: string | null; weekly_downloads: number | null;
    dependencies: number | null; url: string | null }[];
  history: { recorded_at: string; stars: number | null }[];
  dimensions: Record<"momentum" | "maintenance" | "ecosystem" | "readiness", Signal[]>;
};
export type FeedCardT = {
  id: number; type: string; title: string; description: string | null;
  technology: { slug: string; name: string; category: string };
  source: string | null; source_url: string | null; detected_at: string;
  metrics: { stars: number | null; forks: number | null; stars_gained_7d: number | null };
  used_in: { architecture_id: string; title: string; node_id: string }[];
  score: number; reasons: string[];
};
export type Category = { slug: string; name: string; technology_count: number };
export type Me = { id: string; email: string; username: string | null; interests: string[] };
export type Library = { bookmarks: TechSummary[]; follows: TechSummary[] };

export type NodeData = {
  label: string; technology: string | null; component_type: string | null; notes: string; layer: string | null;
  config: Record<string, unknown>; [k: string]: unknown;
};
export type GraphNode = {
  id: string; kind: "component" | "group" | "note"; technology: string | null; position: { x: number; y: number };
  parent?: string | null; width?: number | null; height?: number | null;
  data: { label: string; notes: string; layer: string | null; component_type: string | null; config: Record<string, unknown> };
};
export type GraphEdge = { id: string; source: string; target: string; connection_type: string; label: string; notes: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type Issue = { level: "error" | "warning" | "info"; code: string; message: string; ref: string | null };
export type Report = { ok: boolean; issues: Issue[]; edge_status: Record<string, "verified" | "compatible" | "unverified"> };
export type ArchMeta = { id: string; title: string; description: string | null; visibility: "private" | "public";
  collection_id: string | null; forked_from_id: string | null; updated_at: string; latest_version: number };
export type ArchFull = ArchMeta & { owner: boolean; graph: Graph; version_note: string | null; validation: Report };
export type VersionRow = { version_number: number; note: string | null; created_at: string; nodes: number; edges: number };
export type Component = { slug: string; name: string; category: string; component_type: string; description: string | null;
  license: string | null; stars: number | null; official_url: string | null; documentation_url: string | null; repository_url: string | null };

export type AIOp = { action: string; reason?: string; [k: string]: unknown };
export type Diff = { added_nodes: string[]; removed_nodes: string[]; changed_nodes: string[]; added_edges: string[]; removed_edges: string[] };
export type Proposal = {
  summary: string; explanation: string; assumptions: string[]; trade_offs: string[];
  comparison: { criterion: string; current: string; alternative: string }[]; operations: AIOp[];
};
export type Suggestion = {
  id: string; kind: string; status: string; base_version: number; ai_generated: true; proposal: Proposal; diff: Diff;
  preview_graph: Graph; validation: Report; verified_facts: Record<string, Record<string, unknown>>;
};
export type Finding = { severity: "high" | "medium" | "low" | "info"; category: string; title: string; explanation: string; nodes: string[]; source: "rule" | "ai" };
export type ReviewOut = { version: number; findings: Finding[]; ai_error: string | null; note: string };
export type ExplainOut = { ai_generated: true; answer: string; verified_facts: Record<string, Record<string, unknown>> };
export type SuggestionRow = { id: string; kind: string; prompt: string; status: string; summary: string | null; created_at: string };
