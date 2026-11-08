"use client";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Lock, Note, Stack } from "@phosphor-icons/react";
import type { RFNode } from "@/lib/playground/convert";
import { useEditor } from "@/lib/playground/store";
import { NodeActions } from "./node-actions";

export { TYPE_META } from "./type-meta";
import { TYPE_META } from "./type-meta";

export function ComponentNode({ id, data, selected }: NodeProps<RFNode>) {
  const m = TYPE_META[data.component_type ?? ""] ?? TYPE_META.external_service;
  const locked = useEditor((s) => !!s.locked[id]);
  return (
    <div className="relative flex min-w-[168px] items-center gap-2.5 rounded-xl border bg-surface py-2 pl-2 pr-3.5 transition-[border-color,box-shadow] duration-150"
      style={{ borderColor: selected ? "var(--accent)" : "var(--border-strong)", boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)" : "0 1px 0 rgb(0 0 0 / 0.25)" }}>
      <NodeActions id={id} kind="component" technology={data.technology} componentType={data.component_type} selected={!!selected} />
      <Handle type="target" position={Position.Left} />
      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}><m.Icon size={17} weight="bold" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight">{data.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-none text-muted">
          <span>{m.label}</span>{data.layer && <span className="tag !h-4 !px-1.5 !text-[10px]">{data.layer}</span>}
        </span>
      </span>
      {locked && <Lock size={11} weight="fill" aria-label="Position locked" className="absolute -right-1.5 -top-1.5 rounded-full bg-surface p-0.5 text-muted ring-1 ring-border-strong" />}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function GroupNode({ id, data, selected }: NodeProps<RFNode>) {
  return (
    <div className="h-full w-full rounded-xl border border-dashed" style={{ borderColor: selected ? "var(--accent)" : "var(--border-strong)", background: "color-mix(in srgb, var(--fg) 2.5%, transparent)" }}>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={100} />
      <NodeActions id={id} kind="group" technology={null} componentType={null} selected={!!selected} />
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted"><Stack size={13} />{data.label}</div>
    </div>
  );
}

export function NoteNode({ id, data, selected }: NodeProps<RFNode>) {
  return (
    <div className="max-w-56 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: selected ? "var(--accent)" : "color-mix(in srgb, var(--warn) 45%, transparent)", background: "color-mix(in srgb, var(--warn) 9%, transparent)" }}>
      <NodeActions id={id} kind="note" technology={null} componentType={null} selected={!!selected} />
      <div className="mb-0.5 flex items-center gap-1.5 font-medium"><Note size={13} />{data.label}</div>
      <div className="whitespace-pre-wrap text-muted">{data.notes}</div>
    </div>
  );
}

export const nodeTypes = { component: ComponentNode, group: GroupNode, note: NoteNode };
