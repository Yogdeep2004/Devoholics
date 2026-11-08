"use client";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Archive, Brain, Browser, Cloud, Cpu, Cube, Database, Gauge, HardDrives, Note, Plugs, PlugsConnected, Robot, Stack, TreeStructure } from "@phosphor-icons/react";
import type { RFNode } from "@/lib/playground/convert";

type IconT = React.ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill" }>;
export const TYPE_META: Record<string, { label: string; color: string; Icon: IconT }> = {
  frontend: { label: "Frontend", color: "#6ea8ec", Icon: Browser },
  backend: { label: "Backend", color: "#62c29a", Icon: HardDrives },
  api: { label: "API", color: "#4fbfb6", Icon: PlugsConnected },
  llm: { label: "LLM", color: "#b79ce8", Icon: Brain },
  agent: { label: "Agent", color: "#e58db0", Icon: Robot },
  orchestrator: { label: "Orchestrator", color: "#e5a15c", Icon: TreeStructure },
  database: { label: "Database", color: "#e0c05a", Icon: Database },
  vector_database: { label: "Vector DB", color: "#a6cf5c", Icon: Cube },
  storage: { label: "Storage", color: "#b9b6ad", Icon: Archive },
  mcp_server: { label: "MCP server", color: "#58c4dc", Icon: Plugs },
  external_service: { label: "External", color: "#8f9bb0", Icon: Cloud },
  infrastructure: { label: "Infra", color: "#e07a7a", Icon: Cpu },
  monitoring: { label: "Monitoring", color: "#8c96e8", Icon: Gauge },
};

export function ComponentNode({ data, selected }: NodeProps<RFNode>) {
  const m = TYPE_META[data.component_type ?? ""] ?? TYPE_META.external_service;
  return (
    <div className="flex min-w-[168px] items-center gap-2.5 rounded-xl border bg-surface py-2 pl-2 pr-3.5 transition-[border-color,box-shadow] duration-150"
      style={{ borderColor: selected ? "var(--accent)" : "var(--border-strong)", boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)" : "0 1px 0 rgb(0 0 0 / 0.25)" }}>
      <Handle type="target" position={Position.Left} />
      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}><m.Icon size={17} weight="bold" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight">{data.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-none text-muted">
          <span>{m.label}</span>{data.layer && <span className="tag !h-4 !px-1.5 !text-[10px]">{data.layer}</span>}
        </span>
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function GroupNode({ data, selected }: NodeProps<RFNode>) {
  return (
    <div className="h-full w-full rounded-xl border border-dashed" style={{ borderColor: selected ? "var(--accent)" : "var(--border-strong)", background: "color-mix(in srgb, var(--fg) 2.5%, transparent)" }}>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={100} />
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted"><Stack size={13} />{data.label}</div>
    </div>
  );
}

export function NoteNode({ data, selected }: NodeProps<RFNode>) {
  return (
    <div className="max-w-56 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: selected ? "var(--accent)" : "color-mix(in srgb, var(--warn) 45%, transparent)", background: "color-mix(in srgb, var(--warn) 9%, transparent)" }}>
      <div className="mb-0.5 flex items-center gap-1.5 font-medium"><Note size={13} />{data.label}</div>
      <div className="whitespace-pre-wrap text-muted">{data.notes}</div>
    </div>
  );
}

export const nodeTypes = { component: ComponentNode, group: GroupNode, note: NoteNode };
