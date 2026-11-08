import type { Edge, Node } from "@xyflow/react";
import type { Graph, GraphEdge, GraphNode, NodeData } from "../types";

export type RFNode = Node<NodeData>;
export type RFEdge = Edge<{ connection_type: string; label: string; notes: string }>;

export function toGraph(nodes: RFNode[], edges: RFEdge[]): Graph {
  return {
    nodes: nodes.map((n): GraphNode => ({
      id: n.id, kind: (n.type as GraphNode["kind"]) ?? "component", technology: n.data.technology ?? null,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, parent: n.parentId ?? null,
      width: n.width ?? (typeof n.style?.width === "number" ? n.style.width : null),
      height: n.height ?? (typeof n.style?.height === "number" ? n.style.height : null),
      data: { label: n.data.label, notes: n.data.notes ?? "", layer: n.data.layer ?? null,
              component_type: n.data.component_type ?? null, config: n.data.config ?? {} },
    })),
    edges: edges.map((e): GraphEdge => ({
      id: e.id, source: e.source, target: e.target, connection_type: e.data?.connection_type ?? "custom",
      label: e.data?.label ?? "", notes: e.data?.notes ?? "",
    })),
  };
}

export function fromGraph(g: Graph): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes = g.nodes.map((n): RFNode => ({
    id: n.id, type: n.kind, position: n.position, ...(n.parent ? { parentId: n.parent } : {}),
    ...(n.kind === "group" ? { style: { width: n.width ?? 360, height: n.height ?? 240 } } : {}),
    data: { label: n.data.label, technology: n.technology, component_type: n.data.component_type, notes: n.data.notes,
            layer: n.data.layer, config: n.data.config },
  }));
  nodes.sort((a, b) => Number(b.type === "group") - Number(a.type === "group")); // React Flow needs parents first
  const edges = g.edges.map((e): RFEdge => ({
    id: e.id, source: e.source, target: e.target, data: { connection_type: e.connection_type, label: e.label, notes: e.notes },
  }));
  return { nodes, edges };
}

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

/** Compact left-to-right layered layout (longest-path layering). Used for small previews, never saved. */
export function layeredLayout(g: Graph, dx = 224, dy = 84): Graph {
  const comps = g.nodes.filter((n) => n.kind === "component");
  const depth = new Map<string, number>(comps.map((n) => [n.id, 0]));
  for (let pass = 0; pass < comps.length; pass++) {
    for (const e of g.edges) {
      const d = (depth.get(e.source) ?? 0) + 1;
      if (depth.has(e.target) && d > (depth.get(e.target) ?? 0) && d <= comps.length) depth.set(e.target, d);
    }
  }
  const cols = new Map<number, string[]>();
  for (const n of comps) cols.set(depth.get(n.id) ?? 0, [...(cols.get(depth.get(n.id) ?? 0) ?? []), n.id]);
  const maxRows = Math.max(...[...cols.values()].map((c) => c.length));
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of cols) ids.forEach((id, i) => pos.set(id, { x: d * dx, y: (i + (maxRows - ids.length) / 2) * dy }));
  return { ...g, nodes: comps.map((n) => ({ ...n, parent: null, position: pos.get(n.id) ?? n.position })) };
}
