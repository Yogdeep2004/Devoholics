"use client";
import { ArrowsLeftRight, ArrowSquareOut, Copy, Lock, LockOpen, Trash } from "@phosphor-icons/react";
import { NodeToolbar, Position } from "@xyflow/react";
import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { Component } from "@/lib/types";
import { useEditor } from "@/lib/playground/store";
import { TYPE_META } from "./type-meta";

function ReplaceMenu({ nodeId, type, current, close }: { nodeId: string; type: string; current: string | null; close: () => void }) {
  const patchNode = useEditor((s) => s.patchNode);
  const { data, loading } = useApi<Component[]>(`/components?component_type=${type}&limit=9`);
  const options = (data ?? []).filter((c) => c.slug !== current).slice(0, 7);
  return (
    <div role="menu" aria-label="Replace with" className="pop nodrag nopan absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-xl border border-border-strong bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.7)]">
      <div className="px-2 pb-1 pt-0.5 text-[11px] text-faint">Replace with another {TYPE_META[type]?.label.toLowerCase() ?? "component"}. Connections are kept.</div>
      {loading && <div className="skeleton m-1" style={{ height: 30 }} />}
      {!loading && options.length === 0 && <div className="px-2 py-2 text-xs text-muted">No alternatives of this type.</div>}
      {options.map((c) => (
        <button key={c.slug} role="menuitem" className="row-hover flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors duration-150"
          onClick={() => { patchNode(nodeId, { technology: c.slug, label: c.name, component_type: c.component_type }); close(); }}>
          <span className="truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Small icon actions that float above the selected node. Hidden for read-only views and AI previews. */
export function NodeActions({ id, kind, technology, componentType, selected }: { id: string; kind: string; technology: string | null; componentType: string | null; selected: boolean }) {
  const editable = useEditor((s) => s.editable);
  const locked = useEditor((s) => !!s.locked[id]);
  const toggleLock = useEditor((s) => s.toggleLock);
  const duplicate = useEditor((s) => s.duplicateNode);
  const del = useEditor((s) => s.deleteNode);
  const [menu, setMenu] = useState(false);
  const show = selected && editable;
  return (
    <NodeToolbar isVisible={show} position={Position.Top} offset={10}>
      <div className="action-bar nodrag nopan relative" role="toolbar" aria-label="Node actions">
        <button className="tool-btn" title="Duplicate" aria-label="Duplicate" onClick={() => duplicate(id)}><Copy size={15} /></button>
        {kind === "component" && componentType && (
          <button className="tool-btn" title="Replace with an alternative" aria-label="Replace" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><ArrowsLeftRight size={15} /></button>
        )}
        <button className="tool-btn" title={locked ? "Unlock position" : "Lock position"} aria-label={locked ? "Unlock" : "Lock"} aria-pressed={locked} onClick={() => toggleLock(id)}>{locked ? <Lock size={15} weight="fill" /> : <LockOpen size={15} />}</button>
        {kind === "component" && technology && (
          <a className="tool-btn" title="Open technology profile" aria-label="Open profile" href={`/t/${technology}`} target="_blank" rel="noreferrer"><ArrowSquareOut size={15} /></a>
        )}
        <span className="tool-sep" />
        <button className="tool-btn danger" title="Delete" aria-label="Delete node" onClick={() => del(id)}><Trash size={15} /></button>
        {menu && componentType && <ReplaceMenu nodeId={id} type={componentType} current={technology} close={() => setMenu(false)} />}
      </div>
    </NodeToolbar>
  );
}
