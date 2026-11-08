"use client";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Boxes, Brain, Bot, Cloud, Database, Globe, HardDrive, Layers, Monitor, Plug, Server, StickyNote, Workflow } from "lucide-react";
import type { RFNode } from "@/lib/playground/convert";

export const TYPE_META: Record<string, { label: string; color: string; Icon: React.ComponentType<{ size?: number }> }> = {
  frontend: { label: "Frontend", color: "#60a5fa", Icon: Globe },
  backend: { label: "Backend", color: "#34d399", Icon: Server },
  api: { label: "API", color: "#2dd4bf", Icon: Plug },
  llm: { label: "LLM", color: "#c084fc", Icon: Brain },
  agent: { label: "Agent", color: "#f472b6", Icon: Bot },
  orchestrator: { label: "Orchestrator", color: "#fb923c", Icon: Workflow },
  database: { label: "Database", color: "#fbbf24", Icon: Database },
  vector_database: { label: "Vector DB", color: "#a3e635", Icon: Boxes },
  storage: { label: "Storage", color: "#d6d3d1", Icon: HardDrive },
  mcp_server: { label: "MCP Server", color: "#22d3ee", Icon: Plug },
  external_service: { label: "External", color: "#94a3b8", Icon: Cloud },
  infrastructure: { label: "Infra", color: "#f87171", Icon: Layers },
  monitoring: { label: "Monitoring", color: "#818cf8", Icon: Monitor },
};

export function ComponentNode({ data, selected }: NodeProps<RFNode>) {
  const m = TYPE_META[data.component_type ?? ""] ?? TYPE_META.external_service;
  return (
    <div className="min-w-40 rounded-lg border bg-surface px-3 py-2 shadow-sm"
      style={{ borderColor: selected ? "var(--accent)" : "var(--border)", borderLeft: `4px solid ${m.color}` }}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 text-sm font-medium"><m.Icon size={14} />{data.label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
        <span>{m.label}</span>{data.layer && <span className="rounded bg-surface2 px-1">{data.layer}</span>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function GroupNode({ data, selected }: NodeProps<RFNode>) {
  return (
    <div className="h-full w-full rounded-xl border border-dashed bg-surface2/40" style={{ borderColor: selected ? "var(--accent)" : "var(--border)" }}>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={100} />
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted"><Layers size={12} />{data.label}</div>
    </div>
  );
}

export function NoteNode({ data, selected }: NodeProps<RFNode>) {
  return (
    <div className="max-w-56 rounded-md border bg-warn/10 px-3 py-2 text-xs" style={{ borderColor: selected ? "var(--accent)" : "var(--warn)" }}>
      <div className="mb-0.5 flex items-center gap-1 font-medium"><StickyNote size={12} />{data.label}</div>
      <div className="whitespace-pre-wrap text-muted">{data.notes}</div>
    </div>
  );
}

export const nodeTypes = { component: ComponentNode, group: GroupNode, note: NoteNode };
