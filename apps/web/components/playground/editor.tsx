"use client";
import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type OnSelectionChangeParams } from "@xyflow/react";
import { ArrowLeft, ArrowsOutSimple, Check, GridFour, MapTrifold, TextT, X, ClockCounterClockwise, FloppyDisk, GlobeSimple, LinkSimple, LockSimple, Sparkle, UploadSimple } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ArchFull, Component, Report, VersionRow } from "@/lib/types";
import { fromGraph, measuredFor } from "@/lib/playground/convert";
import { useEditor } from "@/lib/playground/store";
import { cn } from "@/lib/utils";
import { ErrorNote, Skeleton } from "../ui";
import { PublishDialog } from "../blueprints/publish";
import { Assistant } from "./assistant";
import { Inspector } from "./inspector";
import { edgeTypes } from "./edges";
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
    <div className="absolute right-3 top-3 z-20 w-80 rounded-xl border border-border-strong bg-surface p-3 shadow-[0_20px_48px_-16px_rgb(0_0_0/0.7)]" role="dialog" aria-label="Version history">
      <div className="mb-2 flex justify-between"><h2 className="text-sm font-medium">Version history</h2><button onClick={onClose} aria-label="Close history" className="btn btn-icon btn-sm"><X size={14} /></button></div>
      {err && <p role="alert" className="text-xs text-bad">{err}</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {(rows ?? []).map((v) => (
          <li key={v.version_number} className="flex items-center justify-between gap-2 rounded-lg border hairline px-2.5 py-2 text-xs">
            <span><b>v{v.version_number}</b> {v.version_number === current && <span className="text-accent">(current)</span>}<br />
              <span className="text-muted">{v.note ?? "no note"}, {v.nodes} nodes, {new Date(v.created_at).toLocaleString()}</span></span>
            {v.version_number !== current && <button onClick={() => restore(v.version_number)} className="btn btn-sm">Restore</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CanvasToggles(p: { snap: boolean; setSnap: (v: boolean) => void; labels: boolean; setLabels: (v: boolean) => void; minimap: boolean; setMinimap: (v: boolean) => void }) {
  const rf = useReactFlow();
  return (
    <div className="action-bar absolute left-1/2 top-3 z-10 -translate-x-1/2" role="toolbar" aria-label="Canvas view options">
      <button className="tool-btn" title="Snap to grid" aria-label="Snap to grid" aria-pressed={p.snap} onClick={() => p.setSnap(!p.snap)}><GridFour size={15} /></button>
      <button className="tool-btn" title="Connection labels" aria-label="Connection labels" aria-pressed={p.labels} onClick={() => p.setLabels(!p.labels)}><TextT size={15} /></button>
      <button className="tool-btn" title="Minimap" aria-label="Minimap" aria-pressed={p.minimap} onClick={() => p.setMinimap(!p.minimap)}><MapTrifold size={15} /></button>
      <span className="tool-sep" />
      <button className="tool-btn" title="Fit view" aria-label="Fit view" onClick={() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 250 })}><ArrowsOutSimple size={15} /></button>
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
  const [showPublish, setShowPublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snap, setSnap] = useState(false);
  const [labels, setLabels] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"inspector" | "assistant">("inspector");

  const [reload, setReload] = useState(0);
  const router = useRouter();
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
  useEffect(() => { useEditor.getState().setEditable(!readOnly && !ed.preview); }, [readOnly, ed.preview]);
  const previewing = !!ed.preview;
  const shown = useMemo(() => {
    if (!ed.preview) return { nodes: ed.nodes.map((n) => (ed.locked[n.id] ? { ...n, draggable: false } : n)), edges: ed.edges };
    const { nodes, edges } = fromGraph(ed.preview.graph);
    const d = ed.preview.diff;
    const mark = (c: string) => ({ outline: `2px solid ${c}`, outlineOffset: 2, borderRadius: 10 });
    return {
      // Preview nodes are new objects, so React Flow has no measurement for them and keeps them visibility:hidden.
      // Reuse the size we already measured for the same node, or a sensible default for brand-new ones.
      nodes: nodes.map((n) => ({ ...n, draggable: false, selectable: false,
        measured: measuredFor(n, ed.nodes),
        style: { ...n.style, ...(d.added_nodes.includes(n.id) ? mark("var(--good)") : d.removed_nodes.includes(n.id) ? { ...mark("var(--bad)"), opacity: 0.45 } : d.changed_nodes.includes(n.id) ? mark("var(--warn)") : {}) } })),
      edges: edges.map((e) => ({ ...e, selectable: false, ...(d.added_edges.includes(e.id) ? { animated: true } : {}),
        style: d.removed_edges.includes(e.id) ? { stroke: "var(--bad)", strokeDasharray: "2 4", opacity: 0.6 } : undefined })),
    };
  }, [ed.preview, ed.nodes, ed.edges, ed.locked]);
  const edges = useMemo(() => shown.edges.map((e) => {
    const st = ed.report?.edge_status[e.id];
    const text = `${(e.data?.connection_type ?? "").replace(/_/g, " ")}${e.data?.label ? `, ${e.data.label}` : ""}`;
    return { ...e, type: "action", data: { ...e.data!, displayLabel: labels ? text : "" },
      style: { stroke: st === "verified" ? "var(--good)" : st === "compatible" ? "var(--muted)" : "var(--warn)", strokeDasharray: st === "unverified" ? "5 4" : undefined } };
  }), [shown.edges, ed.report, labels]);

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
  const forkPublic = async () => {
    try { const r = await api<{ architecture_id: string }>(`/architectures/${id}/fork`, { method: "POST", token }); router.push(`/playground/${r.architecture_id}`); }
    catch (e) { setErr((e as Error).message); }
  };
  const setVisibility = async (v: "private" | "public") => {
    if (v === "public" && !confirm("Make this architecture public? Anyone with the link can view it (read-only).")) return;
    await api(`/architectures/${id}`, { method: "PATCH", body: { visibility: v }, token });
    setArch((a) => (a ? { ...a, visibility: v } : a));
  };

  if (err && !arch) return <ErrorNote msg={err} />;
  if (!arch) return <Skeleton />;
  const btn = "btn btn-sm";
  const CONNECTIONS = ["http_api", "database_connection", "llm_inference", "embedding_generation", "retrieval", "tool_invocation", "mcp_communication", "event_streaming", "authentication", "data_ingestion", "custom"];
  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b hairline bg-surface px-3">
        <Link href="/playground" className="btn btn-icon btn-sm" aria-label="Back to all architectures"><ArrowLeft size={15} /></Link>
        <input aria-label="Title" disabled={readOnly} value={title} onChange={(e) => { setTitle(e.target.value); useEditor.setState({ dirty: true }); }}
          className="h-8 min-w-32 max-w-xs flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium tracking-tight transition-colors duration-150 hover:border-border focus:border-border-strong focus:outline-none" />
        <div className="flex rounded-lg bg-surface2 p-0.5 text-[13px]" role="group" aria-label="View">
          {(["visual", "technical"] as const).map((v) => (
            <button key={v} aria-pressed={ed.view === v} onClick={() => ed.setView(v)}
              className={cn("rounded-md px-2.5 py-1 capitalize transition-colors duration-150", ed.view === v ? "bg-surface3 text-fg" : "text-muted hover:text-fg")}>{v}</button>
          ))}
        </div>
        <select aria-label="Default connection type" value={ed.defaultConnection} onChange={(e) => ed.setDefaultConnection(e.target.value)} className="field !h-8 !w-auto max-md:hidden">
          {CONNECTIONS.map((c) => <option key={c} value={c}>new link: {c.replace(/_/g, " ")}</option>)}
        </select>
        <div className="flex-1" />
        {saving === "saved" && !ed.dirty && <span role="status" className="inline-flex items-center gap-1 text-xs text-good"><Check size={13} weight="bold" />Saved</span>}
        {err && <span role="alert" className="max-w-56 truncate text-xs text-bad" title={err}>{err}</span>}
        <button className={btn} onClick={() => setShowHistory((s) => !s)}><ClockCounterClockwise size={14} />History <span className="num">v{arch.latest_version}</span></button>
        {!readOnly && (
          <>
            <button className={btn} onClick={() => setVisibility(arch.visibility === "private" ? "public" : "private")}>
              {arch.visibility === "private" ? <LockSimple size={14} /> : <GlobeSimple size={14} />}{arch.visibility === "private" ? "Private" : "Public"}</button>
            {arch.visibility === "public" && (
              <button className={btn} onClick={() => { navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><LinkSimple size={14} />{copied ? "Link copied" : "Copy link"}</button>)}
            <button className={cn(btn, "max-xl:hidden")} onClick={() => setShowPublish(true)}><UploadSimple size={14} />Publish as blueprint</button>
            <input aria-label="Version note" placeholder="Version note" value={note} onChange={(e) => setNote(e.target.value)} className="field !h-8 !w-36 max-lg:hidden" />
            <button onClick={save} disabled={saving === "saving"} className="btn btn-primary btn-sm">
              <FloppyDisk size={14} weight="bold" />{saving === "saving" ? "Saving..." : ed.dirty ? "Save version •" : "Save version"}</button>
          </>
        )}
        {readOnly && <span className="text-xs text-muted">Read-only (public design by another user)</span>}
        {readOnly && token && <button className={btn} onClick={forkPublic}>Fork to my workspace</button>}
      </div>
      <div className="relative flex min-h-0 flex-1">
        {!readOnly && <Palette onAdd={(c) => add(c)} />}
        <div ref={wrap} className="relative min-w-0 flex-1" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}>
          {ed.view === "visual" ? (
            <ReactFlow nodes={shown.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} snapToGrid={snap} snapGrid={[22, 22]} onNodesChange={ed.onNodesChange} onEdgesChange={ed.onEdgesChange}
              onConnect={ed.onConnect} nodesDraggable={!readOnly && !previewing} nodesConnectable={!readOnly && !previewing} elementsSelectable colorMode="dark" fitView fitViewOptions={{ maxZoom: 1, padding: 0.2 }} minZoom={0.2}
              deleteKeyCode={readOnly || previewing ? null : ["Backspace", "Delete"]}
              onSelectionChange={onSelectionChange} proOptions={{ hideAttribution: false }}>
              <Background gap={22} size={1} /><Controls showInteractive={false} />
              {minimap && <MiniMap pannable zoomable nodeColor="var(--surface-3)" nodeStrokeColor="var(--border-strong)" maskColor="rgb(0 0 0 / 0.45)" />}
            </ReactFlow>
          ) : <TechnicalView />}
          {ed.view === "visual" && <CanvasToggles snap={snap} setSnap={setSnap} labels={labels} setLabels={setLabels} minimap={minimap} setMinimap={setMinimap} />}
          {ed.view === "visual" && ed.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center"><p className="font-medium">Start with a technology</p><p className="mt-1 text-sm text-muted">Drag one from the library, or click it to add.</p></div>
            </div>
          )}
          {showHistory && <History id={id} token={token!} current={arch.latest_version} onClose={() => setShowHistory(false)}
            onRestored={() => { setShowHistory(false); setReload((r) => r + 1); }} />}
        </div>
        {showPublish && <PublishDialog architectureId={id} defaultTitle={title} token={token!} dirty={ed.dirty} onClose={() => setShowPublish(false)} />}
        <div className="flex h-full w-[22rem] shrink-0 flex-col border-l hairline bg-surface max-lg:hidden">
          <div className="flex border-b hairline text-[13px]" role="tablist">
            {(["inspector", "assistant"] as const).filter((t) => t === "inspector" || !readOnly).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("relative flex-1 py-2.5 capitalize transition-colors duration-150", tab === t ? "text-fg" : "text-muted hover:text-fg")}>
                {t === "assistant" && <Sparkle size={13} weight="fill" className="mr-1.5 inline text-accent" />}{t}
                {tab === t && <motion.span layoutId="rail-tab" transition={{ type: "spring", duration: 0.3, bounce: 0.1 }} className="absolute inset-x-3 bottom-0 h-0.5 rounded bg-accent" />}
              </button>
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
