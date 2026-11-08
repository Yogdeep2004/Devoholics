"use client";
import "@xyflow/react/dist/style.css";
import { Background, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useMemo } from "react";
import { fromGraph } from "@/lib/playground/convert";
import type { Graph, Report } from "@/lib/types";
import { nodeTypes } from "./nodes";

/** Read-only architecture diagram (blueprints, public designs). */
export function Diagram({ graph, report, height = 420 }: { graph: Graph; report?: Report; height?: number }) {
  const { nodes, edges } = useMemo(() => {
    const g = fromGraph(graph);
    return {
      nodes: g.nodes.map((n) => ({ ...n, draggable: false, selectable: false })),
      edges: g.edges.map((e) => {
        const st = report?.edge_status[e.id];
        return { ...e, selectable: false, label: (e.data?.connection_type ?? "").replace(/_/g, " ") + (e.data?.label ? ` · ${e.data.label}` : ""),
          labelStyle: { fontSize: 10, fill: "var(--muted)" }, labelBgStyle: { fill: "var(--surface)" },
          style: { stroke: st === "verified" ? "var(--good)" : st === "compatible" ? "var(--accent)" : "var(--warn)", strokeDasharray: st === "unverified" ? "5 4" : undefined } };
      }),
    };
  }, [graph, report]);
  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border border-border" role="img" aria-label="Architecture diagram">
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          colorMode="system" fitView fitViewOptions={{ maxZoom: 1, padding: 0.15 }} minZoom={0.2} proOptions={{ hideAttribution: false }}>
          <Background /><Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
