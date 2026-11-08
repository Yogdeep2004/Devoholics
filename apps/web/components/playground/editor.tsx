"use client";
import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type OnSelectionChangeParams } from "@xyflow/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ArchFull, Component, Report, VersionRow } from "@/lib/types";
import { fromGraph } from "@/lib/playground/convert";
import { useEditor } from "@/lib/playground/store";
import { cn } from "@/lib/utils";
import { ErrorNote, Skeleton } from "../ui";
import { Assistant } from "./assistant";
import { Inspector } from "./inspector";
import { nodeTypes } from "./nodes";
import { Palette } from "./palette";
import { TechnicalView } from "./technical";

function History({ id, token, current, onRestored, onClose }: { id: string; token: string; current: number; onRestored: () => void; onClose: () => void }) {
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<VersionRow[]>(`/architectures/${id}/versions`, { token }).then(setRows, (e) => setErr(e.message)), [id, token]);
  useEffect(() => { load(); }, [load, current]);
  const restore = async (n: number) => {
    if (!confirm(`Restore version ${n}? This adds a new version; nothing is deleted.`)) return;
    try { await api(`/architectures/${id}/restore/${n}`, { method: "POST", token }); onRestored(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="absolute right-3 top-3 z-10 w-72 rounded-lg border border-border bg-surface p-3 shadow-lg" role="dialog" aria-label="Version history">
      <div className="mb-2 flex justify-between"><h2 className="text-sm font-medium">Version history</h2><button onClick={onClose} aria-label="Close history" className="text-muted hover:text-fg">✕</button></div>
      {err && <p role="alert" className="text-xs text-bad">{err}</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {(rows ?? []).map((v) => (
          <li key={v.version_number} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-xs">
            <span><b>v{v.version_number}</b> {v.version_number === current && <span className="text-accent">(current)</span>}<br />
              <span className="text-muted">{v.note ?? "—"} · {v.nodes} nodes · {new Date(v.created_at).toLocaleString()}</span></span>
            {v.version_number !== current && <button onClick={() => restore(v.version_number)} className="rounded border border-border px-1.5 py-0.5 hover:text-fg">Restore</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Inner({ id }: { id: string }) {
  const { token, ready } = useAuth();
  const ed = useEditor();
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const [arch, setArch] = useState<ArchFull | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"inspector" | "assistant">("inspector");

  const [reload, setReload] = useState(0);
  const investigate = useSearchParams().get("investigate");
  useEffect(() => {
    if (!ready) return;
    let live = true;
    api<ArchFull>(`/architectures/${id}`, { token }).then((a) => {
      if (!live) return;
      setArch(a); setTitle(a.title); setErr("");
      const st = useEditor.getState();
      st.load(a.graph); st.setReport(a.validation);
      if (investigate && a.graph.nodes.some((n) => n.id === investigate)) {  // deep link from a feed card
        st.setSelected({ kind: "node", id: investigate });
        useEditor.setState((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === investigate })) }));
        setTab("assistant");
      }
    }, (e) => live && setErr(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id, token, reload]);

  // live validation (debounced) against the backend rules
  const graphKey = useMemo(() => JSON.stringify(ed.graph()), [ed.nodes, ed.edges]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!arch?.owner || !token) return;
    const t = setTimeout(() => api<Report>("/architectures/validate", { method: "POST", body: JSON.parse(graphKey), token }).then(ed.setReport, () => {}), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey, arch?.owner, token]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (ed.dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [ed.dirty]);

  const readOnly = !!arch && !arch.owner;
  const previewing = !!ed.preview;
  const shown = useMemo(() => {
    if (!ed.preview) return { nodes: ed.nodes, edges: ed.edges };
    const { nodes, edges } = fromGraph(ed.preview.graph);
    const d = ed.preview.diff;
    const mark = (c: string) => ({ outline: `2px solid ${c}`, outlineOffset: 2, borderRadius: 10 });
    return {
      nodes: nodes.map((n) => ({ ...n, draggable: false, selectable: false,
        style: { ...n.style, ...(d.added_nodes.includes(n.id) ? mark("var(--good)") : d.removed_nodes.includes(n.id) ? { ...mark("var(--bad)"), opacity: 0.45 } : d.changed_nodes.includes(n.id) ? mark("var(--warn)") : {}) } })),
      edges: edges.map((e) => ({ ...e, selectable: false, ...(d.added_edges.includes(e.id) ? { animated: true } : {}),
        style: d.removed_edges.includes(e.id) ? { stroke: "var(--bad)", strokeDasharray: "2 4", opacity: 0.6 } : undefined })),
    };
  }, [ed.preview, ed.nodes, ed.edges]);
  const edges = useMemo(() => shown.edges.map((e) => {
    const st = ed.report?.edge_status[e.id];
    return { ...e, label: `${(e.data?.connection_type ?? "").replace(/_/g, " ")}${e.data?.label ? ` · ${e.data.label}` : ""}`,
      labelStyle: { fontSize: 10, fill: "var(--muted)" }, labelBgStyle: { fill: "var(--surface)" },
      style: { stroke: st === "verified" ? "var(--good)" : st === "compatible" ? "var(--accent)" : "var(--warn)", strokeDasharray: st === "unverified" ? "5 4" : undefined } };
  }), [shown.edges, ed.report]);

  const onSelectionChange = useCallback(({ nodes, edges: es }: OnSelectionChangeParams) => {
    useEditor.getState().setSelected(nodes[0] ? { kind: "node", id: nodes[0].id } : es[0] ? { kind: "edge", id: es[0].id } : null);
  }, []);

  const add = (c: Component, pos?: { x: number; y: number }) => {
    const b = wrap.current?.getBoundingClientRect();
    const p = pos ?? rf.screenToFlowPosition({ x: (b?.left ?? 0) + (b?.width ?? 600) / 2, y: (b?.top ?? 0) + (b?.height ?? 400) / 2 });
    ed.addComponent(c, { x: p.x + Math.random() * 30, y: p.y + Math.random() * 30 });
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/devoholics-component");
    if (raw && !readOnly) add(JSON.parse(raw) as Component, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const replace = async (nodeId: string, slug: string) => {
    const [c] = await api<Component[]>(`/components?slug=${encodeURIComponent(slug)}`);
    if (c) ed.patchNode(nodeId, { technology: c.slug, label: c.name, component_type: c.component_type });
  };

  const save = async () => {
    setSaving("saving"); setErr("");
    try {
      await api(`/architectures/${id}/versions`, { method: "POST", body: { graph: ed.graph(), note: note || null }, token });
      if (title !== arch?.title) await api(`/architectures/${id}`, { method: "PATCH", body: { title }, token });
      ed.markSaved(); setNote(""); setSaving("saved");
      setArch((a) => (a ? { ...a, title, latest_version: a.latest_version + 1 } : a));
    } catch (e) { setSaving("idle"); setErr((e as Error).message); }
  };
  const setVisibility = async (v: "private" | "public") => {
    if (v === "public" && !confirm("Make this architecture public? Anyone with the link can view it (read-only).")) return;
    await api(`/architectures/${id}`, { method: "PATCH", body: { visibility: v }, token });
    setArch((a) => (a ? { ...a, visibility: v } : a));
  };

  if (err && !arch) return <ErrorNote msg={err} />;
  if (!arch) return <Skeleton />;
  const btn = "rounded-md border border-border px-2.5 py-1 text-sm text-muted hover:text-fg disabled:opacity-40";
  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] flex-col sm:-mx-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Link href="/playground" className="text-sm text-muted hover:text-fg">← All</Link>
        <input aria-label="Title" disabled={readOnly} value={title} onChange={(e) => { setTitle(e.target.value); useEditor.setState({ dirty: true }); }}
          className="min-w-40 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-border focus:border-border" />
        <div className="flex overflow-hidden rounded-md border border-border text-sm" role="group" aria-label="View">
          {(["visual", "technical"] as const).map((v) => (
            <button key={v} aria-pressed={ed.view === v} onClick={() => ed.setView(v)} className={cn("px-2.5 py-1 capitalize", ed.view === v ? "bg-accent/15 text-accent" : "text-muted")}>{v}</button>
          ))}
        </div>
        <select aria-label="Default connection type" value={ed.defaultConnection} onChange={(e) => ed.setDefaultConnection(e.target.value)} className="rounded-md border border-border bg-surface2 px-2 py-1 text-sm">
          {["http_api", "database_connection", "llm_inference", "embedding_generation", "retrieval", "tool_invocation", "mcp_communication", "event_streaming", "authentication", "data_ingestion", "custom"].map((c) => <option key={c} value={c}>new link: {c.replace(/_/g, " ")}</option>)}
        </select>
        <button className={btn} onClick={() => setShowHistory((s) => !s)}>History · v{arch.latest_version}</button>
        {!readOnly && (
          <>
            <button className={btn} onClick={() => setVisibility(arch.visibility === "private" ? "public" : "private")}>{arch.visibility === "private" ? "Private" : "Public"}</button>
            <input aria-label="Version note" placeholder="Version note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="w-44 rounded-md border border-border bg-surface2 px-2 py-1 text-sm" />
            <button onClick={save} disabled={saving === "saving"} className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-bg disabled:opacity-60">
              {saving === "saving" ? "Saving…" : ed.dirty ? "Save version •" : "Save version"}</button>
          </>
        )}
        {readOnly && <span className="text-sm text-muted">Read-only (public)</span>}
        {saving === "saved" && !ed.dirty && <span role="status" className="text-xs text-good">Saved</span>}
        {err && <span role="alert" className="text-xs text-bad">{err}</span>}
      </div>
      <div className="relative flex min-h-0 flex-1">
        {!readOnly && <Palette onAdd={(c) => add(c)} />}
        <div ref={wrap} className="relative min-w-0 flex-1" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}>
          {ed.view === "visual" ? (
            <ReactFlow nodes={shown.nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={ed.onNodesChange} onEdgesChange={ed.onEdgesChange}
              onConnect={ed.onConnect} nodesDraggable={!readOnly && !previewing} nodesConnectable={!readOnly && !previewing} elementsSelectable colorMode="system" fitView fitViewOptions={{ maxZoom: 1 }} minZoom={0.2}
              deleteKeyCode={readOnly || previewing ? null : ["Backspace", "Delete"]}
              onSelectionChange={onSelectionChange}>
              <Background /><Controls showInteractive={false} /><MiniMap pannable zoomable />
            </ReactFlow>
          ) : <TechnicalView />}
          {ed.view === "visual" && ed.nodes.length === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">Drag a technology from the library to start designing.</p>
          )}
          {showHistory && <History id={id} token={token!} current={arch.latest_version} onClose={() => setShowHistory(false)}
            onRestored={() => { setShowHistory(false); setReload((r) => r + 1); }} />}
        </div>
        <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
          <div className="flex border-b border-border text-sm" role="tablist">
            {(["inspector", "assistant"] as const).filter((t) => t === "inspector" || !readOnly).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("flex-1 py-2 capitalize", tab === t ? "border-b-2 border-accent text-fg" : "text-muted")}>{t}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "inspector" || readOnly ? <Inspector report={ed.report} onReplace={replace} />
              : <div className="p-3"><Assistant id={id} token={token!} dirty={ed.dirty} onApplied={() => { useEditor.getState().setPreview(null); setReload((r) => r + 1); }} /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Editor({ id }: { id: string }) {
  return <ReactFlowProvider><Inner id={id} /></ReactFlowProvider>;
}
