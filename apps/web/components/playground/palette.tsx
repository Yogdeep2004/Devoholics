"use client";
import { MagnifyingGlass, Note, Stack } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { Component } from "@/lib/types";
import { useEditor } from "@/lib/playground/store";
import { TYPE_META } from "./type-meta";

export function Palette({ onAdd }: { onAdd: (c: Component) => void }) {
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  const [type, setType] = useState("");
  useEffect(() => { const id = setTimeout(() => setD(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  // Default: curated starter set. Searching or filtering by type widens to the whole technology database.
  const wide = !!d || !!type;
  const qs = new URLSearchParams({ limit: "80", ...(wide ? {} : { featured: "true" }), ...(d && { q: d }), ...(type && { component_type: type }) });
  const { data, error, loading } = useApi<Component[]>(`/components?${qs}`);
  const addGroup = useEditor((s) => s.addGroup);
  const addNote = useEditor((s) => s.addNote);
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-3 border-r hairline bg-surface p-3 max-md:hidden" aria-label="Component library">
      <label className="relative block">
        <span className="sr-only">Search components</span>
        <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all technologies" aria-label="Search components" className="field !h-8 !pl-8 !text-[13px]" />
      </label>
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Component type" className="field !h-8 !text-[13px]">
        <option value="">All types</option>
        {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <div className="flex gap-2">
        <button onClick={() => addGroup({ x: 40, y: 40 })} className="btn btn-sm flex-1"><Stack size={13} />Layer</button>
        <button onClick={() => addNote({ x: 60, y: 60 })} className="btn btn-sm flex-1"><Note size={13} />Note</button>
      </div>
      <p className="text-xs text-faint">{wide ? "Search results" : "Starter set"}. Drag onto the canvas or click to add.</p>
      <ul className="-mr-1.5 flex-1 space-y-1 overflow-y-auto pr-1.5">
        {error && <li role="alert" className="text-xs text-bad">{error}</li>}
        {loading && Array.from({ length: 6 }).map((_, i) => <li key={i} className="skeleton" style={{ height: 44 }} />)}
        {data?.length === 0 && <li className="text-xs text-muted">No matches.</li>}
        {data?.map((c) => {
          const m = TYPE_META[c.component_type] ?? TYPE_META.external_service;
          return (
            <li key={c.slug}>
              <button draggable onClick={() => onAdd(c)} onDragStart={(e) => { e.dataTransfer.setData("application/devoholics-component", JSON.stringify(c)); e.dataTransfer.effectAllowed = "move"; }}
                className="row-hover flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] active:cursor-grabbing hover:border-border">
                <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}><m.Icon size={15} weight="bold" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium leading-tight">{c.name}</span><span className="block text-[11px] leading-tight text-muted">{m.label}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
