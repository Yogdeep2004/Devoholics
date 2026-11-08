"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { Component } from "@/lib/types";
import { useEditor } from "@/lib/playground/store";
import { TYPE_META } from "./nodes";

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
    <aside className="flex h-full w-64 shrink-0 flex-col gap-2 border-r border-border bg-surface p-3" aria-label="Component library">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all technologies…" aria-label="Search components"
        className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm" />
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Component type" className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm">
        <option value="">All types</option>
        {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <div className="flex gap-2 text-xs">
        <button onClick={() => addGroup({ x: 40, y: 40 })} className="flex-1 rounded border border-border px-2 py-1 text-muted hover:text-fg">+ Layer</button>
        <button onClick={() => addNote({ x: 60, y: 60 })} className="flex-1 rounded border border-border px-2 py-1 text-muted hover:text-fg">+ Note</button>
      </div>
      <p className="text-[11px] text-muted">{wide ? "Search results" : "Starter set"} · drag onto the canvas or click to add</p>
      <ul className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
        {error && <li role="alert" className="text-xs text-bad">{error}</li>}
        {loading && <li className="text-xs text-muted">Loading…</li>}
        {data?.length === 0 && <li className="text-xs text-muted">No matches.</li>}
        {data?.map((c) => {
          const m = TYPE_META[c.component_type] ?? TYPE_META.external_service;
          return (
            <li key={c.slug}>
              <button draggable onClick={() => onAdd(c)} onDragStart={(e) => { e.dataTransfer.setData("application/devoholics-component", JSON.stringify(c)); e.dataTransfer.effectAllowed = "move"; }}
                className="flex w-full cursor-grab items-center gap-2 rounded-md border border-border bg-surface2 px-2 py-1.5 text-left text-sm hover:border-accent/50">
                <span className="h-5 w-1 rounded" style={{ background: m.color }} />
                <span className="min-w-0 flex-1"><span className="block truncate">{c.name}</span><span className="block text-[11px] text-muted">{m.label}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
